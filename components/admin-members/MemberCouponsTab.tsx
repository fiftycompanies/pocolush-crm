'use client';

import { COUPON_STATUS } from '@/lib/member-constants';
import type { CouponWithDetails } from '@/lib/use-member-detail';

interface Props { coupons: CouponWithDetails[]; }

export default function MemberCouponsTab({ coupons }: Props) {
  if (coupons.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">쿠폰 내역이 없습니다.</p></div>;
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left">
          <th className="px-4 py-3 font-medium text-text-secondary">쿠폰명</th>
          <th className="px-4 py-3 font-medium text-text-secondary">할인</th>
          <th className="px-4 py-3 font-medium text-text-secondary">코드</th>
          <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
          <th className="px-4 py-3 font-medium text-text-secondary">발급일</th>
        </tr></thead>
        <tbody>
          {coupons.map(c => {
            const status = COUPON_STATUS[c.status];
            const discount = c.coupon?.discount_type === 'percentage'
              ? `${c.coupon.discount_value}%`
              : `${c.coupon?.discount_value?.toLocaleString()}원`;
            return (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{c.coupon?.name || '-'}</td>
                <td className="px-4 py-3">{discount}</td>
                <td className="px-4 py-3 font-mono text-xs tracking-wider">{c.coupon_code}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
