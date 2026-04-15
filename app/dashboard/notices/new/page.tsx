'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NoticeForm from '@/components/notices/NoticeForm';
import toast from 'react-hot-toast';

export default function NewNoticePage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const handleSave = async (data: { title: string; content: string; category: string }, publish: boolean) => {
    if (!data.title.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (!data.content.trim()) { toast.error('내용을 입력해주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('notices').insert({
      title: data.title.trim(), content: data.content.trim(), category: data.category,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    });
    if (error) toast.error('저장에 실패했습니다.');
    else { toast.success(publish ? '공지가 발행되었습니다.' : '임시저장되었습니다.'); router.push('/dashboard/notices'); }
    setSaving(false);
  };

  return (
    <NoticeForm
      onSave={handleSave}
      saving={saving}
      onBack={() => router.push('/dashboard/notices')}
      title="새 공지 작성"
    />
  );
}
