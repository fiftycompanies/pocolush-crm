'use client';

/**
 * 공지 고정 드래그 행
 * - §4-2 UX 체크리스트:
 *   [✓] drop line: 색 + animate-pulse + dashed border (색맹 대응 3중)
 *   [✓] 드래그 핸들 w-11 h-11 (44pt 터치 타겟)
 *   [✓] prefers-reduced-motion: reduce → transition 0
 *   [✓] React.memo + 얕은 비교로 리렌더 최소화
 *   [✓] aria-describedby 로 키보드 조작 힌트
 *   [✓] GripVertical 중앙 정렬 + focus ring
 */

import { memo } from 'react';
import Link from 'next/link';
import { Pin, GripVertical, Eye, EyeOff, Edit3, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import type { Notice, NoticeCategory } from '@/types';

interface Props {
  notice: Notice;
  pinning: boolean;
  deleting: boolean;
  overId: string | null;
  activeIndex: number;
  overIndex: number;
  onUnpin: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}

function SortablePinnedRowImpl({
  notice,
  pinning,
  deleting,
  overId,
  activeIndex,
  overIndex,
  onUnpin,
  onTogglePublish,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: notice.id });
  const cat = NOTICE_CATEGORIES[notice.category as NoticeCategory];

  // Drop position indicator: 이 행 위 or 아래에 표시
  const isOver = overId === notice.id;
  const dropAbove = isOver && activeIndex > overIndex;   // 위에서 내려오는 중
  const dropBelow = isOver && activeIndex < overIndex;   // 아래에서 올라오는 중

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        'border-b border-border last:border-0 bg-amber-50/40 hover:bg-amber-50',
        'relative',
        isDragging ? 'opacity-40' : '',
        dropAbove ? 'drop-indicator-above' : '',
        dropBelow ? 'drop-indicator-below' : '',
        'motion-reduce:transition-none',
      ].join(' ')}
      aria-grabbed={isDragging}
    >
      <td className="w-11 px-1 py-3 text-center align-middle">
        <button
          {...attributes}
          {...listeners}
          aria-label={`"${notice.title}" 순서 변경 핸들`}
          aria-describedby="drag-keyboard-help"
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-amber-100 cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-reduce:transition-none"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-text-primary">
        <span className="inline-flex items-center gap-1">
          <Pin className="size-3 text-amber-500" fill="currentColor" aria-hidden="true" />
          {notice.title}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat?.bg }}>
          {cat?.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${notice.is_published ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
          {notice.is_published ? '발행' : '미발행'}
        </span>
      </td>
      <td className="px-4 py-3 text-text-secondary text-xs">
        {new Date(notice.created_at).toLocaleDateString('ko-KR')}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            onClick={onUnpin}
            disabled={pinning}
            className="p-1.5 hover:bg-amber-100 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="고정 해제"
            aria-label={`"${notice.title}" 고정 해제`}
          >
            <Pin className="size-3.5 text-amber-600" fill="currentColor" aria-hidden="true" />
          </button>
          <button
            onClick={onTogglePublish}
            className="p-1.5 hover:bg-accent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={notice.is_published ? '발행 취소' : '발행'}
            aria-label={notice.is_published ? '발행 취소' : '발행'}
          >
            {notice.is_published
              ? <EyeOff className="size-3.5 text-text-secondary" aria-hidden="true" />
              : <Eye className="size-3.5 text-green" aria-hidden="true" />}
          </button>
          <Link
            href={`/dashboard/notices/${notice.id}/edit`}
            className="p-1.5 hover:bg-accent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`"${notice.title}" 수정`}
          >
            <Edit3 className="size-3.5 text-text-secondary" aria-hidden="true" />
          </Link>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 hover:bg-accent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`"${notice.title}" 삭제`}
          >
            <Trash2 className="size-3.5 text-red" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/** props 얕은 비교 — overId / activeIndex / overIndex 가 바뀔 때만 리렌더 */
export const SortablePinnedRow = memo(SortablePinnedRowImpl, (prev, next) => {
  return (
    prev.notice === next.notice &&
    prev.pinning === next.pinning &&
    prev.deleting === next.deleting &&
    prev.overId === next.overId &&
    prev.activeIndex === next.activeIndex &&
    prev.overIndex === next.overIndex &&
    prev.onUnpin === next.onUnpin &&
    prev.onTogglePublish === next.onTogglePublish &&
    prev.onDelete === next.onDelete
  );
});
