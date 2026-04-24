'use client';

/**
 * 새 공지 작성 — PR-H3 draft_id 패턴
 *
 * 흐름:
 * 1. 페이지 마운트 → 빈 notices row INSERT (title='', is_published=false) → draft_id 획득
 * 2. NoticeForm 에 draft_id 를 noticeId prop 로 전달 → 이미지 업로드 가능
 * 3. "임시저장" → UPDATE (발행 X)
 * 4. "발행" → UPDATE + is_published=true, published_at=now
 * 5. 페이지 이탈 시 제목·내용이 비어있고 이미지도 없으면 DELETE (orphan 방지)
 *    — 그 외엔 7일 TTL cron 이 처리 (056 fn_notices_prune_drafts)
 *
 * 블로커 해결:
 * - B-3 (새 공지 이미지 orphan): draft row 선행 생성
 * - B-5 (무한 draft 적체): 7일 TTL cron (056)
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NoticeForm from '@/components/notices/NoticeForm';
import toast from 'react-hot-toast';

export default function NewNoticePage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savedOrPublished, setSavedOrPublished] = useState(false);
  const creatingRef = useRef(false);

  // 1. 빈 draft 공지 선행 생성 (마운트 1회)
  useEffect(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      const { data, error } = await supabase
        .from('notices')
        .insert({
          title: '',
          content: '',
          category: 'notice',
          is_published: false,
        })
        .select('id')
        .single();

      if (error || !data) {
        toast.error('임시 공지 생성 실패 — 페이지를 새로고침해주세요');
        return;
      }
      setDraftId(data.id);
    })();
  }, [supabase]);

  // 2. 이탈 시 빈 draft 정리 (본문·제목 모두 비어있으면)
  //    발행·임시저장 상태면 남김 (savedOrPublished 플래그)
  useEffect(() => {
    return () => {
      if (!draftId || savedOrPublished) return;
      // best-effort cleanup — fire & forget
      // 이미지까지 0장이면 즉시 DELETE, 그 외엔 cron 에서 7일 후 처리
      (async () => {
        const { count } = await supabase
          .from('notice_images')
          .select('id', { count: 'exact', head: true })
          .eq('notice_id', draftId);
        if ((count ?? 0) === 0) {
          await supabase.from('notices').delete().eq('id', draftId);
        }
      })();
    };
  }, [draftId, savedOrPublished, supabase]);

  const handleSave = async (
    data: { title: string; content: string; category: string },
    publish: boolean,
  ) => {
    if (!draftId) {
      toast.error('임시 공지 생성이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!data.title.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (!data.content.trim()) { toast.error('내용을 입력해주세요.'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('notices')
      .update({
        title: data.title.trim(),
        content: data.content.trim(),
        category: data.category,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
      })
      .eq('id', draftId);
    if (error) {
      toast.error('저장에 실패했습니다.');
    } else {
      setSavedOrPublished(true);
      toast.success(publish ? '공지가 발행되었습니다.' : '임시저장되었습니다.');
      router.push('/dashboard/notices');
    }
    setSaving(false);
  };

  return (
    <NoticeForm
      noticeId={draftId}
      onSave={handleSave}
      saving={saving}
      onBack={() => router.push('/dashboard/notices')}
      title="새 공지 작성"
    />
  );
}
