'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit3, Trash2, Eye, EyeOff, Pin, GripVertical, AlertTriangle } from 'lucide-react';
import { useAdminNotices } from '@/lib/use-admin-member-data';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { NoticeCategory, Notice } from '@/types';
import ExportButton from '@/components/ui/ExportButton';
import { auditLog } from '@/lib/audit-log';
import { sendNotification } from '@/lib/notifications';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable,
  verticalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PUSH_RATE_LIMIT_MIN = 5;
const PIN_WARNING_THRESHOLD = 10;
const PUSH_MESSAGE_MAX_LEN = 120;

export default function AdminNoticesPage() {
  const { pinnedNotices, normalNotices, pinnedCount, loading, refetch } = useAdminNotices();
  const supabase = createClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);
  const [pushConfirm, setPushConfirm] = useState<{ noticeId: string; title: string } | null>(null);
  const [pushChecked, setPushChecked] = useState(false);
  const [localPinned, setLocalPinned] = useState<Notice[] | null>(null);

  // 옵티미스틱 UI용 — 드래그 중엔 localPinned 우선 사용
  const displayPinned = localPinned ?? pinnedNotices;

  const togglePublish = async (id: string, published: boolean, wasPinned: boolean) => {
    const update: Record<string, unknown> = { is_published: !published };
    if (!published) update.published_at = new Date().toISOString();
    else update.published_at = null;
    const { error } = await supabase.from('notices').update(update).eq('id', id);
    if (error) { toast.error('변경에 실패했습니다.'); return; }
    // audit: 실제 핀 상태였던 경우만 기록 (false positive 방지)
    if (published && wasPinned) {
      await auditLog({ action: 'auto_unpin_on_unpublish', resource_type: 'notice', resource_id: id });
    }
    toast.success(published ? (wasPinned ? '발행 취소됨 (고정도 해제됨)' : '발행 취소됨') : '발행됨');
    await refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('공지를 삭제하시겠습니까?')) return;
    setDeleting(id);
    await supabase.from('notices').delete().eq('id', id);
    toast.success('삭제되었습니다.');
    refetch();
    setDeleting(null);
  };

  // Pin 추가 (미발행 공지는 바로 토글, 발행된 공지는 푸시 체크박스 모달 경유)
  const handlePin = async (notice: Notice) => {
    if (notice.is_published) {
      setPushChecked(false);
      setPushConfirm({ noticeId: notice.id, title: notice.title });
    } else {
      await executePinToggle(notice.id, false);
    }
  };

  // Pin 해제
  const handleUnpin = async (noticeId: string) => {
    await executePinToggle(noticeId, false);
  };

  const executePinToggle = async (noticeId: string, sendPush: boolean) => {
    setPinning(noticeId);
    try {
      const { data, error } = await supabase.rpc('toggle_notice_pin', { p_notice_id: noticeId });
      if (error) {
        if (error.message.includes('not_admin')) toast.error('권한이 없습니다.');
        else if (error.message.includes('notice_not_found')) toast.error('공지를 찾을 수 없습니다.');
        else toast.error('고정 변경에 실패했습니다.');
        return;
      }
      const isNowPinned = data !== null;

      // 푸시 재발송 (발행 상태 + 사용자 체크 시)
      let pushResent = false;
      if (isNowPinned && sendPush) {
        const cutoff = new Date(Date.now() - PUSH_RATE_LIMIT_MIN * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from('member_notifications')
          .select('id')
          .eq('reference_id', noticeId)
          .eq('type', 'notice')
          .gte('created_at', cutoff)
          .limit(1);
        if (recent && recent.length > 0) {
          toast.error(`${PUSH_RATE_LIMIT_MIN}분 내 이미 알림 발송됨 — 푸시만 skip`);
        } else {
          // 전체 멤버에게 notice 알림 (기존 sendNotification 패턴 따라 한 명씩 INSERT)
          const { data: members } = await supabase.from('members').select('id').eq('status', 'approved');
          if (members && members.length > 0) {
            const { data: notice } = await supabase.from('notices').select('title, content').eq('id', noticeId).maybeSingle();
            if (notice) {
              // 부분 실패 허용 — 한 명 실패 시 전체 reject 방지
              const results = await Promise.allSettled(members.map(m => sendNotification({
                memberId: m.id,
                type: 'notice',
                title: `📢 ${notice.title}`,
                message: String(notice.content).slice(0, PUSH_MESSAGE_MAX_LEN),
                referenceId: noticeId,
                referenceType: 'notice',
              })));
              const failed = results.filter(r => r.status === 'rejected').length;
              pushResent = true;
              if (failed > 0) {
                toast.error(`알림 ${failed}건 전송 실패 (나머지는 발송됨)`);
              }
            }
          }
        }
      }

      await auditLog({
        action: isNowPinned ? 'pin_notice' : 'unpin_notice',
        resource_type: 'notice',
        resource_id: noticeId,
        metadata: { push_resent: pushResent, new_order: data },
      });

      toast.success(isNowPinned ? (pushResent ? '고정됨 · 푸시 발송됨' : '고정됨') : '고정 해제됨');
      await refetch();
    } finally {
      setPinning(null);
      setPushConfirm(null);
    }
  };

  // 드래그 재정렬
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentPinned = localPinned ?? pinnedNotices;
    const oldIndex = currentPinned.findIndex(n => n.id === active.id);
    const newIndex = currentPinned.findIndex(n => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(currentPinned, oldIndex, newIndex);
    setLocalPinned(next); // 옵티미스틱

    const { error } = await supabase.rpc('reorder_notice_pins', {
      p_ordered_ids: next.map(n => n.id),
    });

    if (error) {
      setLocalPinned(null); // 롤백
      toast.error('순서 저장에 실패했습니다.');
    } else {
      toast.success('순서 변경됨');
      await auditLog({
        action: 'reorder_pinned_notices',
        resource_type: 'notice',
        metadata: { new_order: next.map(n => n.id) },
      });
      await refetch();
      setLocalPinned(null);
    }
  };

  const total = pinnedNotices.length + normalNotices.length;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">공지 관리</h1>
          <p className="text-sm text-text-secondary mt-1">
            전체 {total}건
            {pinnedCount > 0 && (
              <span className={`ml-2 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                pinnedCount > PIN_WARNING_THRESHOLD ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <Pin className="size-3" fill="currentColor" />
                고정 {pinnedCount}건
                {pinnedCount > PIN_WARNING_THRESHOLD && <AlertTriangle className="size-3 ml-0.5" />}
              </span>
            )}
          </p>
          {pinnedCount > PIN_WARNING_THRESHOLD && (
            <p className="text-[11px] text-red-600 mt-1">⚠ 고정 공지가 10개를 초과했습니다. 멤버 목록에서 일반 공지가 묻힐 수 있어요.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="notices" dateField="created_at" />
          <Link href="/dashboard/notices/new" className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
            <Plus className="size-4" /> 새 공지
          </Link>
        </div>
      </div>

      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : total === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">공지사항이 없습니다.</p></div>
      ) : (
        <div className="space-y-4">
          {/* 고정 섹션 (드래그 가능) */}
          {displayPinned.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-amber-50/60 flex items-center gap-1.5">
                <Pin className="size-3.5 text-amber-600" fill="currentColor" />
                <span className="text-[12px] font-semibold text-amber-800">고정 공지 ({displayPinned.length})</span>
                <span className="text-[11px] text-amber-700/70 ml-auto">GripVertical 핸들로 드래그 · 키보드: Space → ↑↓ → Space</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="w-10 px-2 py-2"></th>
                  <th className="px-4 py-3 font-medium text-text-secondary">제목</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">카테고리</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">작성일</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
                </tr></thead>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={displayPinned.map(n => n.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {displayPinned.map(n => (
                        <SortablePinnedRow
                          key={n.id}
                          notice={n}
                          pinning={pinning === n.id}
                          deleting={deleting === n.id}
                          onUnpin={() => handleUnpin(n.id)}
                          onTogglePublish={() => togglePublish(n.id, n.is_published, n.pin_order !== null)}
                          onDelete={() => handleDelete(n.id)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>
          )}

          {/* 일반 섹션 */}
          {normalNotices.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              {displayPinned.length > 0 && (
                <div className="px-4 py-2.5 border-b border-border bg-bg-muted/40">
                  <span className="text-[12px] font-medium text-text-tertiary">일반 공지 ({normalNotices.length})</span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  {displayPinned.length > 0 && <th className="w-10 px-2 py-2" aria-hidden="true"></th>}
                  <th className="px-4 py-3 font-medium text-text-secondary">제목</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">카테고리</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">작성일</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
                </tr></thead>
                <tbody>
                  {normalNotices.map(n => {
                    const cat = NOTICE_CATEGORIES[n.category as NoticeCategory];
                    return (
                      <tr key={n.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                        {displayPinned.length > 0 && <td className="w-10 px-2 py-3" aria-hidden="true"></td>}
                        <td className="px-4 py-3 font-medium text-text-primary">{n.title}</td>
                        <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat?.bg }}>{cat?.label}</span></td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${n.is_published ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>{n.is_published ? '발행' : '미발행'}</span></td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{new Date(n.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handlePin(n)}
                              disabled={pinning === n.id}
                              className="p-1.5 hover:bg-amber-50 rounded-md"
                              title="고정하기"
                              aria-label="고정하기"
                            >
                              <Pin className="size-3.5 text-text-tertiary" />
                            </button>
                            <button onClick={() => togglePublish(n.id, n.is_published, false)} className="p-1.5 hover:bg-accent rounded-md" title={n.is_published ? '발행 취소' : '발행'}>
                              {n.is_published ? <EyeOff className="size-3.5 text-text-secondary" /> : <Eye className="size-3.5 text-green" />}
                            </button>
                            <Link href={`/dashboard/notices/${n.id}/edit`} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></Link>
                            <button onClick={() => handleDelete(n.id)} disabled={deleting === n.id} className="p-1.5 hover:bg-accent rounded-md"><Trash2 className="size-3.5 text-red" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 푸시 재발송 확인 모달 */}
      {pushConfirm && (
        <PushConfirmModal
          title={pushConfirm.title}
          checked={pushChecked}
          onChange={setPushChecked}
          onCancel={() => setPushConfirm(null)}
          onConfirm={() => executePinToggle(pushConfirm.noticeId, pushChecked)}
          rateLimitMin={PUSH_RATE_LIMIT_MIN}
        />
      )}
    </div>
  );
}

// 푸시 확인 모달 — ESC·a11y 포함
function PushConfirmModal({
  title, checked, onChange, onCancel, onConfirm, rateLimitMin,
}: {
  title: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  rateLimitMin: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-confirm-title"
        aria-describedby="pin-confirm-desc"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 shadow-xl"
      >
        <div className="p-5 space-y-4">
          <div>
            <h2 id="pin-confirm-title" className="text-sm font-semibold text-text-primary">공지 고정</h2>
            <p className="text-xs text-text-secondary mt-1 truncate">&quot;{title}&quot;</p>
          </div>
          <label className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onChange(e.target.checked)}
              className="mt-0.5 accent-amber-600"
              aria-describedby="pin-confirm-desc"
            />
            <div id="pin-confirm-desc" className="flex-1 text-xs">
              <p className="font-medium text-amber-900">이 공지를 전체 멤버에게 다시 알림 발송</p>
              <p className="text-amber-700/80 mt-0.5">체크하지 않으면 조용히 고정됩니다. {rateLimitMin}분 내 중복 발송은 자동 차단됩니다.</p>
            </div>
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-accent rounded-lg">취소</button>
            <button
              onClick={onConfirm}
              autoFocus
              className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary-dark"
            >
              고정하기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// 드래그 가능한 고정 공지 행
function SortablePinnedRow({
  notice, pinning, deleting, onUnpin, onTogglePublish, onDelete,
}: {
  notice: Notice;
  pinning: boolean;
  deleting: boolean;
  onUnpin: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: notice.id });
  const cat = NOTICE_CATEGORIES[notice.category as NoticeCategory];
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-border last:border-0 bg-amber-50/40 hover:bg-amber-50 ${isDragging ? 'opacity-40' : ''}`}
    >
      <td className="w-10 px-2 py-3 text-center">
        <button
          {...attributes}
          {...listeners}
          aria-label="순서 변경 핸들"
          className="cursor-grab active:cursor-grabbing p-1 text-text-tertiary hover:text-text-primary touch-none"
        >
          <GripVertical className="size-4" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-text-primary">
        <span className="inline-flex items-center gap-1">
          <Pin className="size-3 text-amber-500" fill="currentColor" />
          {notice.title}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat?.bg }}>{cat?.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${notice.is_published ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>{notice.is_published ? '발행' : '미발행'}</span>
      </td>
      <td className="px-4 py-3 text-text-secondary text-xs">{new Date(notice.created_at).toLocaleDateString('ko-KR')}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button onClick={onUnpin} disabled={pinning} className="p-1.5 hover:bg-amber-100 rounded-md" title="고정 해제">
            <Pin className="size-3.5 text-amber-600" fill="currentColor" />
          </button>
          <button onClick={onTogglePublish} className="p-1.5 hover:bg-accent rounded-md" title={notice.is_published ? '발행 취소' : '발행'}>
            {notice.is_published ? <EyeOff className="size-3.5 text-text-secondary" /> : <Eye className="size-3.5 text-green" />}
          </button>
          <Link href={`/dashboard/notices/${notice.id}/edit`} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></Link>
          <button onClick={onDelete} disabled={deleting} className="p-1.5 hover:bg-accent rounded-md"><Trash2 className="size-3.5 text-red" /></button>
        </div>
      </td>
    </tr>
  );
}
