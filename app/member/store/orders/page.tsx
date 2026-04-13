'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useMyOrders } from '@/lib/use-member-data';
import { ORDER_STATUS } from '@/lib/member-constants';

export default function OrdersPage() {
  const { orders, loading } = useMyOrders();

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/member/store" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-bold text-text-primary">신청 내역</h1>
      </div>
      {orders.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center"><p className="text-sm text-text-tertiary">신청 내역이 없습니다.</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => {
            const status = ORDER_STATUS[o.status];
            return (
              <div key={o.id} className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{o.product?.name}</p>
                  <p className="text-[11px] text-text-tertiary">{new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.total_price.toLocaleString()}원</p>
                </div>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
                  {status?.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
