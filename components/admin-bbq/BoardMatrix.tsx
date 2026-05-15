'use client';

import { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { BBQBoardRow } from '@/types';

/**
 * BBQ 운영 보드 — 시설(행) × 타임(열) 매트릭스
 * - 활성 시설 + 예약 보유 비활성 시설 (RPC 가 이미 필터)
 * - 비활성+예약 셀: 노란 경고 ring + AlertTriangle 아이콘
 * - 빈 슬롯: cursor:default (Phase 1: 클릭 무반응)
 * - 회원명 검색 매칭 시 hover ring
 * - role="grid" + a11y
 */
interface Props {
  rows: BBQBoardRow[];                  // 단일 일자 (length = facilities × slots)
  onCellClick: (row: BBQBoardRow) => void;
  searchQuery?: string;
}

interface CellProps {
  row: BBQBoardRow;
  onClick: () => void;
  highlighted: boolean;
  dimmed: boolean;          // E9: 검색 활성 + 비매칭 시 dim
}

// D3: row 의 핵심 필드 비교 — Realtime 갱신 시 변경된 cell 만 re-render
function cellPropsEqual(prev: CellProps, next: CellProps): boolean {
  if (prev.highlighted !== next.highlighted) return false;
  if (prev.dimmed !== next.dimmed) return false;
  const a = prev.row, b = next.row;
  return (
    a.reservation_id === b.reservation_id &&
    a.status === b.status &&
    a.member_name === b.member_name &&
    a.party_size === b.party_size &&
    a.is_event === b.is_event &&
    a.facility_active === b.facility_active
  );
}

const MatrixCell = memo(function MatrixCell({ row, onClick, highlighted, dimmed }: CellProps) {
  const hasReservation = !!row.reservation_id && !!row.status;
  const isInactiveButReserved = !row.facility_active && hasReservation;
  const isInactiveEmpty = !row.facility_active && !hasReservation;

  let cellClass = '';
  let label = '';
  if (isInactiveEmpty) {
    cellClass = 'bg-gray-200/60 border-gray-300 cursor-default';
    label = '비운영';
  } else if (row.status === 'confirmed') {
    cellClass = 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200 cursor-pointer';
    label = '예약완료';
  } else if (row.status === 'completed') {
    cellClass = 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer';
    label = '완료';
  } else if (row.status === 'no_show') {
    cellClass = 'bg-rose-100 border-rose-300 hover:bg-rose-200 cursor-pointer';
    label = '노쇼';
  } else {
    cellClass = 'bg-white border-dashed border-gray-300 cursor-default';
    label = '가용';
  }

  const cursorPointer = hasReservation;

  return (
    <div
      role="gridcell"
      aria-label={`#${row.bbq_number}번 ${row.slot_label} ${label}${row.member_name ? ' ' + row.member_name : ''}${row.party_size ? ' ' + row.party_size + '인' : ''}`}
      tabIndex={cursorPointer ? 0 : -1}
      onClick={cursorPointer ? onClick : undefined}
      onKeyDown={cursorPointer ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      title={!hasReservation && row.facility_active ? '빈 슬롯 — 예약 생성은 Phase 2 예정' : undefined}
      className={`relative min-h-[64px] p-2 border rounded-lg transition-all ${cellClass} ${
        isInactiveButReserved ? 'ring-2 ring-yellow-500 ring-offset-1' : ''
      } ${highlighted ? 'ring-2 ring-primary ring-offset-1' : ''} ${
        dimmed ? 'opacity-30' : ''
      }`}
      data-testid={`board-cell-${row.bbq_number}-${row.slot_number}`}
      data-status={row.status ?? 'available'}
      data-inactive-with-rsv={isInactiveButReserved ? 'true' : undefined}
    >
      {isInactiveButReserved && (
        <span
          className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm"
          title="운영 중단된 시설에 예약 보유"
          data-testid="inactive-with-rsv-badge"
        >
          <AlertTriangle className="size-2.5" aria-hidden="true" />
          운영중단
        </span>
      )}
      {hasReservation && row.member_name && (
        <>
          <div className="text-xs font-medium text-text-primary truncate" data-testid="cell-member-name">
            {row.member_name}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-text-secondary">{row.party_size ?? 1}인</span>
            {row.is_event && (
              <span className="text-[9px] px-1 py-0.5 rounded border border-rose-300 text-rose-600 font-medium">이벤트</span>
            )}
          </div>
        </>
      )}
      {!hasReservation && (
        <span className="text-[11px] text-text-tertiary">{label}</span>
      )}
    </div>
  );
}, cellPropsEqual);

export default function BoardMatrix({ rows, onCellClick, searchQuery }: Props) {
  // 행: bbq_number 그룹화 / 열: slot_number 정렬
  const { facilities, slots, cellMap } = useMemo(() => {
    const facMap = new Map<number, { number: number; name: string; active: boolean }>();
    const slotMap = new Map<number, { number: number; label: string; start: string }>();
    const cells = new Map<string, BBQBoardRow>();

    rows.forEach(r => {
      if (!facMap.has(r.bbq_number)) {
        facMap.set(r.bbq_number, { number: r.bbq_number, name: r.bbq_name, active: r.facility_active });
      }
      if (!slotMap.has(r.slot_number)) {
        slotMap.set(r.slot_number, { number: r.slot_number, label: r.slot_label, start: r.slot_start });
      }
      cells.set(`${r.bbq_number}-${r.slot_number}`, r);
    });

    return {
      facilities: [...facMap.values()].sort((a, b) => a.number - b.number),
      slots: [...slotMap.values()].sort((a, b) => a.number - b.number),
      cellMap: cells,
    };
  }, [rows]);

  const q = (searchQuery || '').trim().toLowerCase();

  return (
    <div
      role="grid"
      aria-label="BBQ 예약 현황 매트릭스"
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 overflow-x-auto"
      data-testid="board-matrix"
    >
      {/* 헤더 */}
      <div
        role="row"
        className="grid items-center gap-2 mb-2 text-xs font-semibold text-text-secondary"
        style={{ gridTemplateColumns: `120px repeat(${slots.length}, minmax(140px, 1fr))` }}
      >
        <div role="columnheader" className="px-2">시설</div>
        {slots.map(s => (
          <div role="columnheader" key={s.number} className="px-2">
            {s.label}
            <span className="ml-1 text-text-tertiary font-normal">{s.start.slice(0, 5)}</span>
          </div>
        ))}
      </div>

      {/* 행 */}
      <div className="space-y-2">
        {facilities.map(f => (
          <div
            key={f.number}
            role="row"
            className="grid items-stretch gap-2"
            style={{ gridTemplateColumns: `120px repeat(${slots.length}, minmax(140px, 1fr))` }}
          >
            <div
              role="rowheader"
              className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                f.active
                  ? 'bg-card border-border text-text-primary'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
            >
              <span>#{f.number}번</span>
              <span className="text-[11px] font-normal text-text-tertiary truncate">{f.name}</span>
              {!f.active && (
                <span className="ml-auto text-[9px] bg-yellow-400 text-yellow-900 px-1 py-0.5 rounded font-bold">중단</span>
              )}
            </div>
            {slots.map(s => {
              const row = cellMap.get(`${f.number}-${s.number}`);
              if (!row) return <div key={s.number} role="gridcell" className="min-h-[64px] bg-gray-50 rounded-lg" />;
              const highlighted = q.length > 0 && (
                (row.member_name || '').toLowerCase().includes(q) ||
                (row.member_phone || '').includes(q)
              );
              const dimmed = q.length > 0 && !highlighted;
              return (
                <MatrixCell
                  key={s.number}
                  row={row}
                  onClick={() => onCellClick(row)}
                  highlighted={highlighted}
                  dimmed={dimmed}
                />
              );
            })}
          </div>
        ))}
      </div>

      {facilities.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-text-tertiary">운영 중인 BBQ 시설이 없습니다.</p>
          <p className="text-xs text-text-tertiary mt-1">시설 설정에서 활성화하거나 예약 데이터를 확인해주세요.</p>
        </div>
      )}
    </div>
  );
}
