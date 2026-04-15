'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NoticeForm from '@/components/notices/NoticeForm';
import toast from 'react-hot-toast';
import type { Notice } from '@/types';

export default function EditNoticePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchNotice = useCallback(async () => {
    const { data, error } = await supabase.from('notices').select('*').eq('id', id).single();
    if (error || !data) { toast.error('공지를 찾을 수 없습니다.'); router.push('/dashboard/notices'); return; }
    setNotice(data);
    setLoading(false);
  }, [supabase, id, router]);

  useEffect(() => { fetchNotice(); }, [fetchNotice]);

  const handleSave = async (data: { title: string; content: string; category: string }, publish: boolean) => {
    if (!data.title.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (!data.content.trim()) { toast.error('내용을 입력해주세요.'); return; }
    setSaving(true);

    const togglePublish = publish !== notice?.is_published;
    const update: Record<string, unknown> = {
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category,
    };

    if (togglePublish) {
      update.is_published = publish;
      update.published_at = publish ? new Date().toISOString() : null;
    }

    const { error } = await supabase.from('notices').update(update).eq('id', id);
    if (error) toast.error('수정에 실패했습니다.');
    else { toast.success('공지가 수정되었습니다.'); router.push('/dashboard/notices'); }
    setSaving(false);
  };

  if (loading) return <div className="py-10 text-center text-sm text-text-secondary">불러오는 중...</div>;
  if (!notice) return null;

  return (
    <NoticeForm
      initialData={notice}
      onSave={handleSave}
      saving={saving}
      onBack={() => router.push('/dashboard/notices')}
      title="공지 수정"
    />
  );
}
