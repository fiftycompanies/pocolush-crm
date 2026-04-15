'use client';

import { ORDER_STATUS } from '@/lib/member-constants';
import type { OrderWithProduct } from '@/lib/use-member-detail';

interface Props { orders: OrderWithProduct[]; }

export default function MemberOrdersTab({ orders }: Props) {
  if (orders.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">서비스 신청 내역이 없습니다.</p></div>;
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left">
          <th className="px-4 py-3 font-medium text-text-secondary">상품</th>
          <th className="px-4 py-3 font-medium text-text-secondary">금액</th>
          <th className="px-4 py-3 font-medium text-text-secondary">결제</th>
          <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
          <th className="px-4 py-3 font-medium text-text-secondary">신청일</th>
        </tr></thead>
        <tbody>
          {orders.map(o => {
            const status = ORDER_STATUS[o.status];
            return (
              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{o.product?.name || '-'}</td>
                <td className="px-4 py-3">{o.total_price.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    o.payment_status === '납부완료' ? 'text-green bg-green-light' :
                    o.payment_status === '미납' ? 'text-red bg-red-light' : 'text-yellow bg-yellow-light'
                  }`}>{o.payment_status || '대기'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
