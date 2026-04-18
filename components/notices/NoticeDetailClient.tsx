'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Notice, NoticeCategory } from '@/types';

export default function NoticeDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('notices').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setNotice(data);
      setLoading(false);
    });
  }, [supabase, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-text-secondary">불러오는 중...</p>
      </div>
    );
  }
  if (!notice) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-text-tertiary">공지를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const cat = NOTICE_CATEGORIES[notice.category as NoticeCategory];

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm"
      >
        <ArrowLeft className="size-4" /> 목록으로
      </button>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: cat?.color, backgroundColor: cat?.bg }}
          >
            {cat?.label}
          </span>
          <span className="text-[11px] text-text-tertiary">
            {notice.published_at ? new Date(notice.published_at).toLocaleDateString('ko-KR') : ''}
          </span>
        </div>
        <h1 className="text-lg font-bold text-text-primary mb-4">{notice.title}</h1>
        <div className="prose prose-sm max-w-none text-text-primary" style={{ whiteSpace: 'pre-wrap' }}>
          <Markdown
            remarkPlugins={[remarkGfm]}
            urlTransform={(url) => {
              if (/^(https?|mailto):/.test(url)) return url;
              return '';
            }}
          >
            {notice.content}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
