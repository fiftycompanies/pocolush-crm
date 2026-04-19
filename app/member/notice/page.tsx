'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pin } from 'lucide-react';
import { useNotices } from '@/lib/use-member-data';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import type { NoticeCategory, Notice } from '@/types';

const TABS: { key: string; label: string }[] = [
  { key: '', label: '전체공지' },
  { key: 'orientation', label: '오리엔테이션' },
  { key: 'event', label: '이벤트' },
  { key: 'info', label: '안내' },
];

export default function MemberNoticePage() {
  const [category, setCategory] = useState('');
  const { pinnedNotices, normalNotices, loading } = useNotices(category || undefined);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;

  const hasAny = pinnedNotices.length > 0 || normalNotices.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-text-primary">공지사항</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setCategory(t.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              category === t.key ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-text-secondary border-border hover:border-[#16A34A]/40'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {!hasAny ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center"><p className="text-sm text-text-tertiary">공지사항이 없습니다.</p></div>
      ) : (
        <div className="space-y-4">
          {/* 고정 섹션 */}
          {pinnedNotices.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <Pin className="size-3.5 text-amber-500" fill="currentColor" />
                <h2 className="text-[13px] font-semibold text-text-primary">중요 공지</h2>
                <span className="text-[11px] text-text-tertiary">({pinnedNotices.length})</span>
              </div>
              <div className="space-y-2">
                {pinnedNotices.map(n => <NoticeCard key={n.id} notice={n} pinned />)}
              </div>
            </div>
          )}

          {/* 구분선 (고정 있고 일반도 있을 때만) */}
          {pinnedNotices.length > 0 && normalNotices.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-text-tertiary">일반 공지</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* 일반 섹션 */}
          {normalNotices.length > 0 && (
            <div className="space-y-2">
              {normalNotices.map(n => <NoticeCard key={n.id} notice={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice: n, pinned = false }: { notice: Notice; pinned?: boolean }) {
  const cat = NOTICE_CATEGORIES[n.category as NoticeCategory];
  return (
    <Link href={`/member/notice/${n.id}`}
      className={`block bg-white border rounded-2xl p-4 hover:shadow-sm transition-shadow ${
        pinned ? 'border-amber-300 bg-amber-50/60' : 'border-border'
      }`}>
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5"
          style={{ color: cat?.color, backgroundColor: cat?.bg }}>{cat?.label}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {pinned && (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <Pin className="size-2.5" fill="currentColor" />
                고정
              </span>
            )}
            <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
          </div>
          <p className="text-[11px] text-text-tertiary mt-1">{n.published_at ? new Date(n.published_at).toLocaleDateString('ko-KR') : ''}</p>
        </div>
      </div>
    </Link>
  );
}
