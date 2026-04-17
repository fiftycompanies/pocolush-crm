'use client';

interface Stats {
  active: number;
  expiringSoon: number;
  cancelled: number;
  newThisMonth: number;
}

export default function MembershipStatsCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: '활성', value: stats.active, color: 'text-emerald-600' },
    { label: '만료 임박 (D-30)', value: stats.expiringSoon, color: 'text-amber-600' },
    { label: '취소/정지', value: stats.cancelled, color: 'text-red-600' },
    { label: '이번 달 신규 발급', value: stats.newThisMonth, color: 'text-blue-600' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-card border rounded-xl p-4">
          <p className="text-xs text-text-tertiary">{c.label}</p>
          <p
            className={`text-[28px] leading-8 font-bold mt-1 ${c.color}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
