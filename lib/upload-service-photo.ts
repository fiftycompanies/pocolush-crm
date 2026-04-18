// 결과물 사진 업로드 유틸
// - 클라이언트 리사이즈 (max 1600px, JPEG q0.8)
// - Storage 업로드 → DB INSERT
// - DB 실패 시 Storage rollback

import { createClient } from '@/lib/supabase/client';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Canvas 기반 클라이언트 리사이즈 — 큰 원본은 용량·대역폭 절감 */
async function resizeImage(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', JPEG_QUALITY);
  });
  bitmap.close();
  return { blob, width, height };
}

/** 서비스 주문 1건에 대한 사진 1장 업로드 */
export async function uploadServiceOrderPhoto(
  serviceOrderId: string,
  file: File,
  caption?: string
): Promise<{ id: string; display_url: string } | { error: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: '이미지 파일만 업로드 가능합니다' };
  }

  const supabase = createClient();

  // Auth 재확인 (어드민만)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return { error: '관리자 권한이 필요합니다' };

  // 리사이즈
  let resized: ResizedImage;
  try {
    resized = await resizeImage(file);
  } catch (e) {
    return { error: '이미지 처리 실패: ' + (e as Error).message };
  }

  // Storage 경로: service-photos/{order_id}/{timestamp}-{random}.jpg
  const random = Math.random().toString(36).slice(2, 10);
  const storage_path = `${serviceOrderId}/${Date.now()}-${random}.jpg`;

  // Storage 업로드
  const { error: upErr } = await supabase.storage
    .from('service-photos')
    .upload(storage_path, resized.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (upErr) {
    return { error: 'Storage 업로드 실패: ' + upErr.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from('service-photos')
    .getPublicUrl(storage_path);

  // DB INSERT
  const { data, error: dbErr } = await supabase
    .from('service_order_photos')
    .insert({
      service_order_id: serviceOrderId,
      storage_path,
      display_url: publicUrl,
      caption: caption ?? null,
      file_size_bytes: resized.blob.size,
      mime_type: 'image/jpeg',
      width: resized.width,
      height: resized.height,
      uploaded_by: user.id,
    })
    .select('id, display_url')
    .single();

  if (dbErr || !data) {
    // rollback — Storage object 삭제
    await supabase.storage.from('service-photos').remove([storage_path]);
    return { error: 'DB 저장 실패: ' + (dbErr?.message ?? 'unknown') };
  }

  return { id: data.id, display_url: data.display_url };
}

/** 사진 1장 삭제 (DB + Storage 동시) */
export async function deleteServiceOrderPhoto(
  photoId: string,
  storagePath: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error: dbErr } = await supabase
    .from('service_order_photos')
    .delete()
    .eq('id', photoId);
  if (dbErr) return { error: 'DB 삭제 실패: ' + dbErr.message };

  const { error: stErr } = await supabase.storage
    .from('service-photos')
    .remove([storagePath]);
  if (stErr) {
    // DB는 지워졌으나 Storage 실패 — 로그만 남기고 성공 처리 (orphan은 별도 cleanup)
    console.warn('[deleteServiceOrderPhoto] storage remove failed:', stErr.message);
  }
  return { ok: true };
}

/** 캡션 / 순서 업데이트 */
export async function updateServiceOrderPhoto(
  photoId: string,
  updates: { caption?: string | null; display_order?: number }
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('service_order_photos')
    .update(updates)
    .eq('id', photoId);
  if (error) return { error: error.message };
  return { ok: true };
}
