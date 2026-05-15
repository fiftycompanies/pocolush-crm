'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { auditLog } from '@/lib/audit-log';
import { useMediaQuery } from '@/lib/use-media-query';
import type { BBQBoardRow } from '@/types';

/**
 * 예약 셀 클릭 시 우측 사이드 패널 (≥1024px) / bottom-sheet (<1024px)
 * - role="dialog" aria-modal + focus trap (ESC, [×], outside click)
 * - 상태변경 액션 (완료/노쇼/취소) + busy 가드 + 확인 다이얼로그
 * - 회원 phone 노출은 admin only (072 RPC가 보장)
 */
interface Props {
  row: BBQBoardRow;
  memberId?: string;     // 회원 상세 이동용 (별도 fetch 필요시)
  onClose: () => void;
  onUpdated: () => void;
}

// 모듈 레벨 Set — 페이지 라이프타임 동안 같은 예약 audit 1회만
const auditedSet: Set<string> = new Set();

export default function ReservationSidePanel({ row, onClose, onUpdated }: Props) {
  const supabase = createClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [busy, setBusy] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  // 회원 ID 조회 (회원 상세 링크용)
  useEffect(() => {
    if (!row.reservation_id) return;
    (async () => {
      const { data } = await supabase
        .from('bbq_reservations')
        .select('member_id')
        .eq('id', row.reservation_id!)
        .single();
      if (data) setMemberId(data.member_id);
    })();
  }, [row.reservation_id, supabase]);

  // E3: Focus trap + ESC + trigger 복귀
  useEffect(() => {
    previousFocus.current = document.activeElement;
    panelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, [onClose]);

  // D4: PIPA audit — 같은 reservation_id 재오픈 시 중복 호출 방지 (1년 ~60K row 폭증 차단)
  useEffect(() => {
    if (!row.reservation_id || !row.member_phone) return;
    if (auditedSet.has(row.reservation_id)) return;
    auditedSet.add(row.reservation_id);
    auditLog({
      action: 'view_bbq_reservation_detail',
      resource_type: 'bbq_reservation',
      resource_id: row.reservation_id,
      metadata: { bbq_number: row.bbq_number, slot: row.slot_number, date: row.reservation_date },
    }).catch(e => console.error('[ReservationSidePanel] audit failed', e));
  }, [row.reservation_id, row.member_phone, row.bbq_number, row.slot_number, row.reservation_date]);

  const updateStatus = async (newStatus: 'completed' | 'no_show' | 'cancelled') => {
    if (busy || !row.reservation_id) return;
    const confirmMsg = {
      completed: '이 예약을 완료 처리하시겠습니까?',
      no_show: '이 예약을 노쇼 처리하시겠습니까?',
      cancelled: '이 예약을 취소하시겠습니까?',
    }[newStatus];
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const update: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'cancelled') update.cancelled_at = new Date().toISOString();
      const { error } = await supabase.from('bbq_reservations').update(update).eq('id', row.reservation_id);
      if (error) {
        toast.error('처리 실패: ' + error.message);
        return;
      }
      toast.success('처리되었습니다.');
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const isInactiveWithRsv = !row.facility_active && row.reservation_id;
  const formatPrice = (p: number | null) => p ? `₩${p.toLocaleString()}` : '-';
  const formatDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00+09:00');
    const wd = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} (${wd})`;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-panel-title"
        tabIndex={-1}
        data-testid="reservation-side-panel"
        className={
          isDesktop
            ? 'fixed top-0 right-0 h-full w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-y-auto'
            : 'fixed bottom-0 left-0 right-0 max-h-[85vh] bg-card border-t border-border shadow-2xl z-50 flex flex-col overflow-y-auto rounded-t-2xl'
        }
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 id="side-panel-title" className="text-base font-bold text-text-primary">
            BBQ #{row.bbq_number}번 · {row.slot_label}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-md"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* 비운영+예약 경고 배지 */}
          {isInactiveWithRsv && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
              <AlertTriangle className="size-4 text-yellow-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-yellow-900">
                <strong>운영 중단된 시설에 예약이 있습니다.</strong>
                <br />운영자 확인이 필요합니다.
              </div>
            </div>
          )}

          {/* 회원 정보 */}
          {row.member_name && (
            <div className="bg-bg-muted rounded-xl p-4 space-y-1.5">
              <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">회원 정보</div>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-text-primary" data-testid="panel-member-name">{row.member_name}</span>
                {memberId && (
                  <Link
                    href={`/dashboard/members/${memberId}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    회원 상세 <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
              <div className="text-sm font-mono text-text-secondary" data-testid="panel-member-phone">{row.member_phone}</div>
            </div>
          )}

          {/* 예약 정보 */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">예약 정보</div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">예약일</dt>
                <dd className="font-medium" data-testid="panel-reservation-date">{formatDate(row.reservation_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">타임</dt>
                <dd className="font-medium">{row.slot_label} ({row.slot_start.slice(0, 5)})</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">시설</dt>
                <dd className="font-medium">#{row.bbq_number}번 · {row.bbq_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">인원</dt>
                <dd className="font-medium">{row.party_size ?? 1}인</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">상품</dt>
                <dd className="font-medium">{row.product_name ?? '기본'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">금액</dt>
                <dd className="font-mono font-semibold">{formatPrice(row.snapshotted_price)}</dd>
              </div>
              {row.is_event && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">이벤트</dt>
                  <dd className="text-rose-600 font-medium">이벤트 적용</dd>
                </div>
              )}
            </dl>
          </div>

          {/* 상태 변경 */}
          {row.status === 'confirmed' && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">상태 변경</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={busy}
                  data-testid="panel-action-complete"
                  className="h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
                >
                  완료
                </button>
                <button
                  onClick={() => updateStatus('no_show')}
                  disabled={busy}
                  data-testid="panel-action-noshow"
                  className="h-10 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40"
                >
                  노쇼
                </button>
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={busy}
                  data-testid="panel-action-cancel"
                  className="h-10 rounded-xl border-2 border-rose-300 text-rose-700 bg-white text-sm font-semibold hover:bg-rose-50 disabled:opacity-40"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {row.status && row.status !== 'confirmed' && (
            <div className="text-xs text-text-tertiary pt-2 border-t border-border">
              이미 <strong className="text-text-primary">{
                row.status === 'completed' ? '완료' : row.status === 'no_show' ? '노쇼' : '취소'
              }</strong> 처리된 예약입니다.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
