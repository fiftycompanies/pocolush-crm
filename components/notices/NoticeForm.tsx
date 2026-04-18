'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Notice } from '@/types';

interface NoticeFormProps {
  initialData?: Notice;
  onSave: (data: { title: string; content: string; category: string }, publish: boolean) => Promise<void>;
  saving: boolean;
  onBack: () => void;
  title: string;
}

export default function NoticeForm({ initialData, onSave, saving, onBack, title }: NoticeFormProps) {
  const [formTitle, setFormTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [category, setCategory] = useState<string>(initialData?.category || 'notice');

  const handleSave = async (publish: boolean) => {
    await onSave({ title: formTitle, content, category }, publish);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1000px' }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /></button>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">{title}</h1>
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="공지 제목 *"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
          {Object.entries(NOTICE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용 (마크다운 지원) *"
          rows={12}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y font-mono" />
        <p className="text-[11px] text-text-tertiary mt-1.5">
          💡 빈 줄로 문단 구분, 줄 끝에 공백 2칸이면 줄바꿈. Markdown 지원: **굵게**, ## 제목, - 목록
        </p>
      </div>

      {content && (
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-text-tertiary mb-3">미리보기</p>
          <div className="prose prose-sm max-w-none" style={{ whiteSpace: 'pre-wrap' }}>
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => handleSave(false)} disabled={saving} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-accent disabled:opacity-40">임시저장</button>
        <button onClick={() => handleSave(true)} disabled={saving} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-40">
          {saving ? '저장 중...' : initialData?.is_published ? '발행 취소' : '발행하기'}
        </button>
      </div>
    </div>
  );
}
