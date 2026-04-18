'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { auditLog } from '@/lib/audit-log';
import BbqProductModal from './BbqProductModal';
import BbqEventModal from './BbqEventModal';

export interface BbqProduct {
  id: string;
  name: string;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface BbqEvent {
  id: string;
  product_id: string;
  event_name: string;
  event_price: number;
  start_date: string;
  end_date: string;
}

export default function BbqProductsPageClient() {
  const supabase = createClient();
  const [products, setProducts] = useState<BbqProduct[]>([]);
  const [events, setEvents] = useState<BbqEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState<{ mode: 'new' | 'edit'; product?: BbqProduct } | null>(null);
  const [eventModal, setEventModal] = useState<{ productId: string; event?: BbqEvent } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [pRes, eRes] = await Promise.all([
      supabase.from('bbq_products').select('*').order('created_at'),
      supabase.from('bbq_events').select('*').order('start_date', { ascending: false }),
    ]);
    setProducts((pRes.data as BbqProduct[]) || []);
    setEvents((eRes.data as BbqEvent[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleDeleteProduct = async (product: BbqProduct) => {
    if (!confirm(`"${product.name}" 상품을 삭제하시겠습니까? (연결된 이벤트도 함께 삭제됩니다)`)) return;
    const { error } = await supabase.from('bbq_products').delete().eq('id', product.id);
    if (error) {
      toast.error('삭제 실패: ' + error.message);
      return;
    }
    await auditLog({
      action: 'delete_bbq_product',
      resource_type: 'bbq_product',
      resource_id: product.id,
      metadata: { name: product.name },
    });
    toast.success('상품이 삭제되었습니다');
    fetch();
  };

  const handleDeleteEvent = async (event: BbqEvent) => {
    if (!confirm(`"${event.event_name}" 이벤트를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('bbq_events').delete().eq('id', event.id);
    if (error) {
      toast.error('삭제 실패: ' + error.message);
      return;
    }
    await auditLog({
      action: 'delete_bbq_event',
      resource_type: 'bbq_event',
      resource_id: event.id,
      metadata: { event_name: event.event_name, product_id: event.product_id },
    });
    toast.success('이벤트가 삭제되었습니다');
    fetch();
  };

  const eventsForProduct = (productId: string) =>
    events.filter(e => e.product_id === productId);

  const isEventActive = (ev: BbqEvent) => ev.start_date <= todayStr && ev.end_date >= todayStr;

  return (
    <div className="space-y-5" style={{ maxWidth: '1100px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">바베큐 상품 관리</h1>
          <p className="text-sm text-text-secondary mt-1">총 {products.length}개 상품 · {events.length}개 이벤트</p>
        </div>
        <button
          onClick={() => setProductModal({ mode: 'new' })}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark"
        >
          <Plus className="size-4" /> 신규 상품
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
      ) : products.length === 0 ? (
        <p className="text-center text-sm text-text-tertiary py-10">등록된 상품이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {products.map(p => {
            const evs = eventsForProduct(p.id);
            const active = evs.find(isEventActive);
            return (
              <div key={p.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{p.name}</h3>
                      {!p.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">비활성</span>}
                      {active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          🎉 {active.event_name} 진행중 ({active.event_price.toLocaleString()}원)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      기본가 {p.base_price.toLocaleString()}원 · {p.duration_minutes}분
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEventModal({ productId: p.id })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      <Calendar className="size-3.5" /> 이벤트 추가
                    </button>
                    <button
                      onClick={() => setProductModal({ mode: 'edit', product: p })}
                      className="p-1.5 rounded-lg hover:bg-accent"
                      title="수정"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                      title="삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                {evs.length > 0 && (
                  <ul className="divide-y divide-border text-sm">
                    {evs.map(ev => (
                      <li key={ev.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium">{ev.event_name}</span>
                          <span className="font-mono text-emerald-700">
                            {ev.event_price === 0 ? '무료' : `${ev.event_price.toLocaleString()}원`}
                          </span>
                          <span className="text-text-tertiary">
                            {ev.start_date} ~ {ev.end_date}
                          </span>
                          {isEventActive(ev) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              진행중
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEventModal({ productId: p.id, event: ev })}
                            className="p-1 hover:bg-accent rounded"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(ev)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {productModal && (
        <BbqProductModal
          mode={productModal.mode}
          product={productModal.product}
          onClose={() => setProductModal(null)}
          onSuccess={() => { setProductModal(null); fetch(); }}
        />
      )}

      {eventModal && (
        <BbqEventModal
          productId={eventModal.productId}
          event={eventModal.event}
          onClose={() => setEventModal(null)}
          onSuccess={() => { setEventModal(null); fetch(); }}
        />
      )}
    </div>
  );
}
