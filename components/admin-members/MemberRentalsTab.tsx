'use client';

import { format } from 'date-fns';
import { FARM_STATUS } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import type { RentalWithFarm } from '@/lib/use-member-detail';

interface Props { rentals: RentalWithFarm[]; }

export default function MemberRentalsTab({ rentals }: Props) {
  if (rentals.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">임대 계약이 없습니다.</p></div>;
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left">
          <th className="px-4 py-3 font-medium text-text-secondary">존/사이트</th>
          <th className="px-4 py-3 font-medium text-text-secondary">플랜</th>
          <th className="px-4 py-3 font-medium text-text-secondary">기간</th>
          <th className="px-4 py-3 font-medium text-text-secondary">월 금액</th>
          <th className="px-4 py-3 font-medium text-text-secondary">결제</th>
          <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
        </tr></thead>
        <tbody>
          {rentals.map(r => {
            const zoneName = r.farm?.zone?.name || '';
            const farmNum = r.farm?.number || '';
            const statusColor = r.status === 'active' ? '#059669' : r.status === 'expired' ? '#DC2626' : '#6B7280';
            const statusBg = r.status === 'active' ? '#ECFDF5' : r.status === 'expired' ? '#FEF2F2' : '#F3F4F6';
            const statusLabel = r.status === 'active' ? '활성' : r.status === 'expired' ? '만료' : '취소';
            const payColor = r.payment_status === '납부완료' ? '#059669' : r.payment_status === '미납' ? '#DC2626' : '#D97706';
            const payBg = r.payment_status === '납부완료' ? '#ECFDF5' : r.payment_status === '미납' ? '#FEF2F2' : '#FFFBEB';

            return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{zoneName} {farmNum}번</td>
                <td className="px-4 py-3">{r.plan || '-'}</td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {format(new Date(r.start_date), 'yy.M.d')} ~ {format(new Date(r.end_date), 'yy.M.d')}
                </td>
                <td className="px-4 py-3">{r.monthly_fee.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <Badge label={`${r.payment_method} · ${r.payment_status}`} color={payColor} bg={payBg} />
                </td>
                <td className="px-4 py-3">
                  <Badge label={statusLabel} color={statusColor} bg={statusBg} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
