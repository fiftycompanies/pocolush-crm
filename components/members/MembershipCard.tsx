'use client';

import type { Membership } from '@/types';

interface Props {
  membership: Membership;
  compact?: boolean;
}

export default function MembershipCard({ membership, compact }: Props) {
  const isExpired = new Date(membership.end_date) < new Date();
  const isActive = membership.status === 'active' && !isExpired;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${isActive ? 'bg-gradient-to-br from-green-800 to-green-950' : 'bg-gradient-to-br from-gray-600 to-gray-800'} text-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌱</span>
            <span className="text-sm font-bold tracking-wider">POCOLUSH</span>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isActive ? 'bg-green-400/20 text-green-300' : 'bg-gray-400/20 text-gray-300'}`}>
            {isActive ? '활성' : isExpired ? '만료' : '취소'}
          </span>
        </div>

        <p className={`font-bold tracking-wide mb-3 ${compact ? 'text-base' : 'text-lg'}`}>회 원 증</p>

        <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          <div className="flex justify-between">
            <span className="text-white/60">회원번호</span>
            <span className="font-mono font-bold tracking-wider">{membership.membership_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">구좌수</span>
            <span>{membership.plots}구좌</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">유효기간</span>
            <span className="text-xs">{membership.start_date} ~ {membership.end_date}</span>
          </div>
        </div>

        {!compact && membership.benefits && membership.benefits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-[10px] font-bold tracking-wider text-white/50 mb-2">MEMBER BENEFITS</p>
            <div className="space-y-1">
              {(membership.benefits as string[]).map((b, i) => (
                <p key={i} className="text-xs text-white/80 flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5">✔</span> {b}
                </p>
              ))}
            </div>
          </div>
        )}

        {!compact && (
          <p className="text-[10px] text-white/40 mt-3">경북 칠곡군 북삼읍 보손4길 87-17</p>
        )}
      </div>
    </div>
  );
}
