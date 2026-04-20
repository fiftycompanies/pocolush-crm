'use client';

/**
 * 드래그 중 마우스를 따라다니는 floating clone.
 * - §4-2 UX: rotate-[1.5deg] scale-[1.02] shadow-lg (v3.1 결정)
 * - <table> wrap 없이 <div> grid 로 미러링 — DOM invalid 경고 회피
 * - prefers-reduced-motion: reduce → 기울기/스케일 제거
 */

import { Pin, GripVertical } from 'lucide-react';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import type { Notice, NoticeCategory } from '@/types';

export function DragOverlayClone({ notice }: { notice: Notice }) {
  const cat = NOTICE_CATEGORIES[notice.category as NoticeCategory];
  return (
    <div
      className="grid grid-cols-[44px_1fr_120px_80px_120px_140px] items-center gap-0 bg-white rounded-xl shadow-lg ring-1 ring-primary/20 rotate-[1.5deg] scale-[1.02] motion-reduce:rotate-0 motion-reduce:scale-100"
      style={{ width: 'min(1200px, 95vw)' }}
      aria-hidden="true"
    >
      <div className="w-11 h-11 flex items-center justify-center text-amber-600">
        <GripVertical className="size-4" />
      </div>
      <div className="px-4 py-3 font-medium text-text-primary truncate">
        <span className="inline-flex items-center gap-1">
          <Pin className="size-3 text-amber-500" fill="currentColor" />
          {notice.title}
        </span>
      </div>
      <div className="px-4 py-3">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat?.bg }}>
          {cat?.label}
        </span>
      </div>
      <div className="px-4 py-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${notice.is_published ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
          {notice.is_published ? '발행' : '미발행'}
        </span>
      </div>
      <div className="px-4 py-3 text-text-secondary text-xs">
        {new Date(notice.created_at).toLocaleDateString('ko-KR')}
      </div>
      <div className="px-4 py-3 text-text-tertiary text-xs">—</div>
    </div>
  );
}
