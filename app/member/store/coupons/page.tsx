'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useMyCoupons } from '@/lib/use-member-data';
import { COUPON_STATUS } from '@/lib/member-constants';

export default function MyCouponsPage() {
  const { coupons, loading } = useMyCoupons();

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/member/store" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-bold text-text-primary">내 쿠폰함</h1>
      </div>
      {coupons.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center"><p className="text-sm text-text-tertiary">발급된 쿠폰이 없습니다.</p></div>
      ) : (
        <div className="space-y-2">
          {coupons.map(c => {
            const status = COUPON_STATUS[c.status];
            return (
              <div key={c.id} className="bg-white border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-text-primary">{c.coupon?.name}</p>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
                    {status?.label}
                  </span>
                </div>
                <p className="text-[11px] text-text-tertiary mb-2">{c.coupon?.description}</p>
                {c.status === 'issued' && (
                  <div className="bg-bg-muted rounded-lg px-3 py-2 text-center">
                    <p className="text-[10px] text-text-tertiary mb-0.5">쿠폰 코드</p>
                    <p className="text-lg font-bold text-text-primary tracking-widest">{c.coupon_code}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
