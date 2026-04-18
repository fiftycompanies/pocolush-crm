'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { auditLog } from '@/lib/audit-log';
import { sendNotification } from '@/lib/notifications';
import { deleteServiceOrderPhoto, updateServiceOrderPhoto } from '@/lib/upload-service-photo';
import ServiceOrderPhotoUploader from './ServiceOrderPhotoUploader';
import type { ServiceOrderPhoto } from '@/types';

interface OrderDetail {
  id: string;
  member_id: string;
  status: string;
  total_price: number;
  created_at: string;
  completed_at: string | null;
  payment_status: string;
  admin_note: string | null;
  product?: { id: string; name: string } | null;
  member?: { id: string; name: string; phone: string | null } | null;
}

interface Props {
  orderId: string;
  onClose: () => void;
  onRefetch: () => void;
}

export default function ServiceOrderDrawer({ orderId, onClose, onRefetch }: Props) {
  const supabase = createClient();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    const [orderRes, photoRes] = await Promise.all([
      supabase
        .from('service_orders')
        .select('id, member_id, status, total_price, created_at, completed_at, payment_status, admin_note, product:store_products(id, name), member:members(id, name, phone)')
        .eq('id', orderId)
        .maybeSingle(),
      supabase
        .from('service_order_photos')
        .select('*')
        .eq('service_order_id', orderId)
        .order('display_order'),
    ]);
    setOrder((orderRes.data as unknown as OrderDetail) ?? null);
    setPhotos((photoRes.data as ServiceOrderPhoto[]) ?? []);
  }, [supabase, orderId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeletePhoto = async (photo: ServiceOrderPhoto) => {
    if (!confirm('사진을 삭제하시겠습니까? (되돌릴 수 없습니다)')) return;
    setBusy(true);
    const res = await deleteServiceOrderPhoto(photo.id, photo.storage_path);
    setBusy(false);
    if ('error' in res) { toast.error(res.error); return; }
    await auditLog({
      action: 'delete_service_photo',
      resource_type: 'service_order_photo',
      resource_id: photo.id,
      metadata: { service_order_id: orderId },
    });
    toast.success('삭제되었습니다');
    fetchAll();
  };

  const handleUpdateCaption = async (photo: ServiceOrderPhoto, caption: string) => {
    if (caption === (photo.caption ?? '')) return;
    const res = await updateServiceOrderPhoto(photo.id, { caption: caption || null });
    if ('error' in res) { toast.error(res.error); return; }
    fetchAll();
  };

  const handleCompleteAndNotify = async () => {
    if (!order) return;
    const ok = confirm(
      `주문을 "완료" 상태로 변경하고 고객에게 알림을 보냅니다.\n\n` +
      `업로드된 사진: ${photos.length}장\n\n계속하시겠습니까?`
    );
    if (!ok) return;
    setBusy(true);

    // 상태 변경
    const { error: upErr } = await supabase
      .from('service_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', orderId);
    if (upErr) {
      toast.error('상태 변경 실패: ' + upErr.message);
      setBusy(false);
      return;
    }

    // 알림
    try {
      await sendNotification({
        memberId: order.member_id,
        type: 'service_complete',
        title: `${order.product?.name ?? '서비스'} 작업 완료`,
        message: '결과물 사진이 업로드되었습니다. 마이페이지에서 확인하세요.',
        referenceId: orderId,
        referenceType: 'service_order',
      });
    } catch (e) {
      console.warn('[ServiceOrderDrawer] notification failed', e);
    }

    await auditLog({
      action: 'complete_service_order',
      resource_type: 'service_order',
      resource_id: orderId,
      metadata: { photo_count: photos.length, product_name: order.product?.name ?? null },
    });

    toast.success('완료 처리 + 알림 발송 완료');
    setBusy(false);
    onRefetch();
    onClose();
  };

  if (!order) {
    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
        <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-lg z-50 p-6">
          <p className="text-sm text-text-secondary">불러오는 중...</p>
        </aside>
      </>
    );
  }

  const canComplete = order.status === 'processing';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-lg z-50 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-sm font-semibold">스토어 주문 상세</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <dl className="grid grid-cols-3 gap-y-2 text-xs">
            <dt className="text-text-tertiary">상품</dt>
            <dd className="col-span-2 font-medium">{order.product?.name ?? '-'}</dd>
            <dt className="text-text-tertiary">회원</dt>
            <dd className="col-span-2">{order.member?.name} ({order.member?.phone || '-'})</dd>
            <dt className="text-text-tertiary">금액</dt>
            <dd className="col-span-2">{order.total_price.toLocaleString()}원</dd>
            <dt className="text-text-tertiary">신청일</dt>
            <dd className="col-span-2">{format(new Date(order.created_at), 'yyyy.M.d HH:mm', { locale: ko })}</dd>
            <dt className="text-text-tertiary">상태</dt>
            <dd className="col-span-2">{order.status}</dd>
            <dt className="text-text-tertiary">결제</dt>
            <dd className="col-span-2">{order.payment_status}</dd>
            {order.completed_at && (
              <>
                <dt className="text-text-tertiary">완료일</dt>
                <dd className="col-span-2">{format(new Date(order.completed_at), 'yyyy.M.d HH:mm', { locale: ko })}</dd>
              </>
            )}
          </dl>

          <div className="pt-3 border-t border-border">
            <h3 className="text-xs font-semibold mb-2">결과물 사진 ({photos.length}장)</h3>
            <ServiceOrderPhotoUploader
              serviceOrderId={orderId}
              onUploaded={fetchAll}
            />
          </div>

          {photos.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h3 className="text-xs font-semibold mb-2">업로드 완료</h3>
              <ul className="grid grid-cols-2 gap-2">
                {photos.map(p => (
                  <li key={p.id} className="border border-border rounded-lg p-2 space-y-2">
                    <div className="relative">
                      {/* 최적화는 Next.js <Image>로 가능하나 list 내에서는 <img> 유지 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.display_url}
                        alt={p.caption ?? ''}
                        className="w-full h-32 object-cover rounded"
                      />
                      <button
                        disabled={busy}
                        onClick={() => handleDeletePhoto(p)}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-600"
                        title="삭제"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      defaultValue={p.caption ?? ''}
                      onBlur={e => handleUpdateCaption(p, e.target.value)}
                      placeholder="캡션 (선택)"
                      disabled={busy}
                      className="w-full text-xs px-2 py-1 border border-border rounded"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canComplete && (
            <div className="pt-3 border-t border-border">
              <button
                disabled={busy}
                onClick={handleCompleteAndNotify}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                완료 처리 + 알림 발송
              </button>
              <p className="text-[11px] text-text-tertiary mt-1.5 text-center">
                상태를 &quot;완료&quot;로 변경하고 고객에게 결과물 알림을 보냅니다.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
