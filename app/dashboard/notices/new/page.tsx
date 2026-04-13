'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

export default function NewNoticePage() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('notice');
  const [saving, setSaving] = useState(false);

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (!content.trim()) { toast.error('내용을 입력해주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('notices').insert({
      title: title.trim(), content: content.trim(), category,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    });
    if (error) toast.error('저장에 실패했습니다.');
    else { toast.success(publish ? '공지가 발행되었습니다.' : '임시저장되었습니다.'); router.push('/dashboard/notices'); }
    setSaving(false);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1000px' }}>
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /></button>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">새 공지 작성</h1>
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="공지 제목 *"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
          {Object.entries(NOTICE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용 (마크다운 지원) *"
          rows={12}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y font-mono" />
      </div>

      {content && (
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-text-tertiary mb-3">미리보기</p>
          <div className="prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown></div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => handleSave(false)} disabled={saving} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-accent disabled:opacity-40">임시저장</button>
        <button onClick={() => handleSave(true)} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-40">{saving ? '저장 중...' : '발행하기'}</button>
      </div>
    </div>
  );
}
