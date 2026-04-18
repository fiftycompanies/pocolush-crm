'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ORDER_STATUS } from '@/lib/member-constants';
import type { ServiceOrder, ServiceOrderPhoto } from '@/types';
import OrderPhotoGallery from './OrderPhotoGallery';

type OrderWithPhotos = ServiceOrder & {
  product?: { name: string };
  photos?: ServiceOrderPhoto[];
};

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithPhotos | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchOrder = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/m/login');
      return;
    }
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, product:store_products(name), photos:service_order_photos(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    // 본인 주문인지 확인 (RLS가 1차 방어, 클라이언트에서도 2차 체크)
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (!member || data.member_id !== member.id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    // photos는 display_order 순
    const sortedPhotos = [...(data.photos ?? [])].sort(
      (a: ServiceOrderPhoto, b: ServiceOrderPhoto) => a.display_order - b.display_order
    );
    setOrder({ ...data, photos: sortedPhotos });
    setLoading(false);
  }, [supabase, orderId, router]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  }

  if (notFound || !order) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/member/store/orders" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></Link>
          <h1 className="text-lg font-bold text-text-primary">신청 상세</h1>
        </div>
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-text-tertiary">주문을 찾을 수 없거나 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  const status = ORDER_STATUS[order.status];
  const photoCount = order.photos?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/member/store/orders" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-bold text-text-primary">신청 상세</h1>
      </div>

      {/* 주문 요약 */}
      <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">{order.product?.name}</p>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
            {status?.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px] text-text-secondary">
          <div>
            <p className="text-[10px] text-text-tertiary">신청일</p>
            <p className="font-medium text-text-primary">{new Date(order.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary">금액</p>
            <p className="font-medium text-text-primary">{order.total_price.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary">결제</p>
            <p className="font-medium text-text-primary">{order.payment_status || '대기'} {order.payment_method && `· ${order.payment_method}`}</p>
          </div>
          {order.completed_at && (
            <div>
              <p className="text-[10px] text-text-tertiary">완료일</p>
              <p className="font-medium text-text-primary">{new Date(order.completed_at).toLocaleDateString('ko-KR')}</p>
            </div>
          )}
        </div>
        {order.admin_note && (
          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] text-text-tertiary mb-1">관리자 메모</p>
            <p className="text-xs text-text-primary whitespace-pre-wrap">{order.admin_note}</p>
          </div>
        )}
      </div>

      {/* 결과물 갤러리 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Camera className="size-3.5 text-text-tertiary" />
          <h2 className="text-[13px] font-semibold text-text-primary">작업 결과물</h2>
          <span className="text-[11px] text-text-tertiary">({photoCount})</span>
        </div>
        {photoCount === 0 ? (
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-text-tertiary">
              {order.status === 'completed'
                ? '업로드된 결과물 사진이 없습니다.'
                : '작업이 완료되면 결과물 사진이 업로드됩니다.'}
            </p>
          </div>
        ) : (
          <OrderPhotoGallery photos={order.photos ?? []} />
        )}
      </div>
    </div>
  );
}
