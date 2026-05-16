'use client';

interface Stats {
  active: number;
  /** D-7 임박 — memberships.end_date 기준 (PR-C1) */
  expiringIn7: number;
  /** D-30 임박 — memberships.end_date 기준 (PR-C1) */
  expiringIn30: number;
  cancelled: number;
  newThisMonth: number;
}

/**
 * 회원권 KPI (PR-C1, Q-C1=한카드2값)
 * - 만료 임박 카드: D-7 (빨강 강조) + D-30 (주황) 한 카드 2값
 * - 카드 수 4 유지 (grid 변경 0, 반응형 회귀 0)
 * - "회원권 만료 임박" 컨텍스트 명시 (농장 임대 D-30 과 분리 — 별개 테이블)
 */
export default function MembershipStatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 활성 */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs text-text-tertiary">활성</p>
        <p
          className="text-[28px] leading-8 font-bold mt-1 text-emerald-600"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.active}
        </p>
      </div>

      {/* 회원권 만료 임박 — D-7 / D-30 한 카드 2-값 */}
      <div className="bg-card border rounded-xl p-4" data-testid="memberships-kpi-expiring">
        <p className="text-xs text-text-tertiary">회원권 만료 임박</p>
        <div
          className="flex items-baseline gap-3 mt-1"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <div>
            <p className="text-[24px] leading-7 font-bold text-red-600">{stats.expiringIn7}</p>
            <p className="text-[10px] text-red-600/80 mt-0.5">D-7</p>
          </div>
          <div className="opacity-70">
            <p className="text-[20px] leading-6 font-semibold text-amber-600">{stats.expiringIn30}</p>
            <p className="text-[10px] text-amber-600/80 mt-0.5">D-30</p>
          </div>
        </div>
      </div>

      {/* 취소/정지 */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs text-text-tertiary">취소/정지</p>
        <p
          className="text-[28px] leading-8 font-bold mt-1 text-red-600"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.cancelled}
        </p>
      </div>

      {/* 이번 달 신규 발급 */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs text-text-tertiary">이번 달 신규 발급</p>
        <p
          className="text-[28px] leading-8 font-bold mt-1 text-blue-600"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.newThisMonth}
        </p>
      </div>
    </div>
  );
}
