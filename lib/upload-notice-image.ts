/**
 * 공지사항 이미지 업로드 서비스 (056 notice_images)
 * - 클라이언트 리사이즈 (max 1600px, JPEG q0.8)
 * - Storage 업로드 (notice-images 버킷)
 * - DB INSERT (notice_images 테이블)
 * - DB 실패 시 Storage rollback
 * - 10장/2MB 가드 (클라이언트 + DB 트리거 이중 방어)
 *
 * PR-H3, Phase 0.5 hot-track
 */

import { createClient } from '@/lib/supabase/client';
import { resizeImage, validateImageFile, type ResizedImage } from '@/lib/image-utils';
import type { NoticeImage } from '@/types';

const BUCKET = 'notice-images';
const MAX_IMAGES_PER_NOTICE = 10;

export interface UploadedNoticeImage extends NoticeImage {
  display_url: string;
}

/**
 * 공지 1건에 이미지 1장 업로드
 * @param noticeId — 056 FK 대상. 신규 공지는 draft_id 패턴으로 선생성된 notices.id 사용
 */
export async function uploadNoticeImage(
  noticeId: string,
  file: File,
  caption?: string,
): Promise<{ image: UploadedNoticeImage } | { error: string }> {
  // 1. 파일 검증 (MIME + 2MB)
  const validation = validateImageFile(file);
  if (!validation.ok) return { error: validation.error! };

  const supabase = createClient();

  // 2. Auth 확인 (admin)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return { error: '관리자 권한이 필요합니다' };

  // 3. 10장 클라이언트 가드 (DB 트리거와 중복 방어 — 빠른 피드백용)
  const { count } = await supabase
    .from('notice_images')
    .select('id', { count: 'exact', head: true })
    .eq('notice_id', noticeId);

  if ((count ?? 0) >= MAX_IMAGES_PER_NOTICE) {
    return { error: `한 공지에 최대 ${MAX_IMAGES_PER_NOTICE}장까지만 업로드 가능합니다` };
  }

  // 4. 리사이즈
  let resized: ResizedImage;
  try {
    resized = await resizeImage(file);
  } catch (e) {
    return { error: '이미지 처리 실패: ' + (e as Error).message };
  }

  // 5. Storage 경로: {notice_id}/{timestamp}-{random}.jpg
  const random = Math.random().toString(36).slice(2, 10);
  const storage_path = `${noticeId}/${Date.now()}-${random}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storage_path, resized.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (upErr) {
    return { error: 'Storage 업로드 실패: ' + upErr.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storage_path);

  // 6. DB INSERT (display_order=0 → 트리거가 COUNT 로 자동 할당)
  const { data, error: dbErr } = await supabase
    .from('notice_images')
    .insert({
      notice_id: noticeId,
      storage_path,
      caption: caption ?? null,
      display_order: 0,
      file_size_bytes: resized.blob.size,
      mime_type: 'image/jpeg',
      created_by: user.id,
    })
    .select('*')
    .single();

  if (dbErr || !data) {
    // rollback — Storage orphan 방지
    await supabase.storage.from(BUCKET).remove([storage_path]);
    return { error: 'DB 저장 실패: ' + (dbErr?.message ?? 'unknown') };
  }

  return {
    image: { ...(data as NoticeImage), display_url: publicUrl },
  };
}

/** 공지 1건에 속한 이미지 목록 + display_url 해석 */
export async function listNoticeImages(
  noticeId: string,
): Promise<{ images: UploadedNoticeImage[] } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notice_images')
    .select('*')
    .eq('notice_id', noticeId)
    .order('display_order', { ascending: true });

  if (error) return { error: error.message };

  const images: UploadedNoticeImage[] = (data ?? []).map((row) => {
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(row.storage_path);
    return { ...(row as NoticeImage), display_url: publicUrl };
  });

  return { images };
}

/** 이미지 삭제 — DB only (Storage 는 AFTER DELETE 트리거가 처리) */
export async function deleteNoticeImage(
  imageId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notice_images')
    .delete()
    .eq('id', imageId);
  if (error) return { error: 'DB 삭제 실패: ' + error.message };
  return { ok: true };
}

/** 캡션 또는 display_order 업데이트 */
export async function updateNoticeImage(
  imageId: string,
  updates: { caption?: string | null; display_order?: number },
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notice_images')
    .update(updates)
    .eq('id', imageId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * 순서 재배열 — 2개 swap (WCAG 2.1.1 키보드 ◀▶ 지원용)
 * 경쟁 조건이 드물고 order 는 단조 증가 유지됨 (UX Best-Effort)
 */
export async function reorderNoticeImages(
  a: { id: string; order: number },
  b: { id: string; order: number },
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  // 간단 swap — 격리 수준 낮음. 동시 편집 drift 는 re-fetch 로 해결
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('notice_images').update({ display_order: b.order }).eq('id', a.id),
    supabase.from('notice_images').update({ display_order: a.order }).eq('id', b.id),
  ]);
  if (e1 || e2) return { error: (e1 || e2)!.message };
  return { ok: true };
}
