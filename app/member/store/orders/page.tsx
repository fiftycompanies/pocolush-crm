'use client';

import { ArrowLeft, Camera, ChevronRight } from 'lucide-react';
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
            const hasPhotos = (o.photo_count ?? 0) > 0;
            const canOpen = hasPhotos || o.status === 'completed' || o.status === 'processing';
            const content = (
              <div className="bg-white border border-border rounded-2xl p-4 hover:border-text-tertiary transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-text-primary truncate">{o.product?.name}</p>
                      {hasPhotos && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          <Camera className="size-2.5" />
                          결과물 {o.photo_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-0.5">{new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.total_price.toLocaleString()}원</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
                      {status?.label}
                    </span>
                    {canOpen && <ChevronRight className="size-4 text-text-tertiary" />}
                  </div>
                </div>
                {/* 결제상태 표시 */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                  <span className="text-[10px] text-text-tertiary">결제</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    o.payment_status === '납부완료' ? 'text-green bg-green-light' :
                    o.payment_status === '미납' ? 'text-red bg-red-light' :
                    'text-yellow bg-yellow-light'
                  }`}>{o.payment_status || '대기'}</span>
                  {o.payment_method && <span className="text-[10px] text-text-tertiary">{o.payment_method}</span>}
                </div>
              </div>
            );
            return canOpen ? (
              <Link key={o.id} href={`/member/store/orders/${o.id}`} className="block">{content}</Link>
            ) : (
              <div key={o.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
