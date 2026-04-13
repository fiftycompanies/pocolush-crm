'use client';

import type { Membership, Farm } from '@/types';

interface Props {
  membership: Membership & { farm?: Farm };
  memberName: string;
}

export default function MembershipCard({ membership, memberName }: Props) {
  const isActive = membership.status === 'active';

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{
        background: isActive
          ? 'linear-gradient(135deg, #059669 0%, #16A34A 50%, #22C55E 100%)'
          : 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
      }}>
      {/* Glow animation for active */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.15), transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'spin 2.5s linear infinite',
          }} />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌱</span>
            <span className="font-bold text-sm tracking-tight">자람터 회원권</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isActive ? 'bg-white/20' : 'bg-white/10'
          }`}>
            {isActive ? 'ACTIVE' : membership.status.toUpperCase()}
          </span>
        </div>

        {/* Member name */}
        <p className="text-xl font-bold mb-3">{memberName}님</p>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-y-2 text-[12px]">
          <div>
            <span className="text-white/60">회원권 ID</span>
            <p className="font-semibold text-[13px]">{membership.membership_code}</p>
          </div>
          <div>
            <span className="text-white/60">규모</span>
            <p className="font-semibold text-[13px]">{membership.plots}구좌 (약 {membership.plots * 3}평)</p>
          </div>
          <div>
            <span className="text-white/60">농장 번호</span>
            <p className="font-semibold text-[13px]">
              {membership.farm ? `${membership.farm.number}번 농장` : '-'}
            </p>
          </div>
          <div>
            <span className="text-white/60">유효기간</span>
            <p className="font-semibold text-[13px]">
              {membership.start_date.replace(/-/g, '.')} ~ {membership.end_date.replace(/-/g, '.')}
            </p>
          </div>
        </div>
      </div>

      {/* CSS for spin animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
