'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { auditLog } from '@/lib/audit-log';
import type { BbqEvent } from './BbqProductsPageClient';

interface Props {
  productId: string;
  event?: BbqEvent;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BbqEventModal({ productId, event, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [eventName, setEventName] = useState(event?.event_name ?? '');
  const [eventPrice, setEventPrice] = useState(event?.event_price ?? 0);
  const [startDate, setStartDate] = useState(event?.start_date ?? today);
  const [endDate, setEndDate] = useState(event?.end_date ?? today);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!eventName.trim()) { toast.error('이벤트명을 입력하세요'); return; }
    if (endDate < startDate) { toast.error('종료일이 시작일보다 빠릅니다'); return; }
    setBusy(true);
    if (event) {
      const { error } = await supabase.from('bbq_events').update({
        event_name: eventName.trim(),
        event_price: eventPrice,
        start_date: startDate,
        end_date: endDate,
      }).eq('id', event.id);
      if (error) { toast.error('수정 실패: ' + error.message); setBusy(false); return; }
      await auditLog({
        action: 'update_bbq_event',
        resource_type: 'bbq_event',
        resource_id: event.id,
        metadata: { event_name: eventName, event_price: eventPrice, period: `${startDate}~${endDate}` },
      });
      toast.success('이벤트가 수정되었습니다');
    } else {
      const { data, error } = await supabase.from('bbq_events').insert({
        product_id: productId,
        event_name: eventName.trim(),
        event_price: eventPrice,
        start_date: startDate,
        end_date: endDate,
      }).select().single();
      if (error) { toast.error('등록 실패: ' + error.message); setBusy(false); return; }
      await auditLog({
        action: 'create_bbq_event',
        resource_type: 'bbq_event',
        resource_id: (data as { id: string }).id,
        metadata: { product_id: productId, event_name: eventName, event_price: eventPrice, period: `${startDate}~${endDate}` },
      });
      toast.success('이벤트가 등록되었습니다');
    }
    setBusy(false);
    onSuccess();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold">{event ? '이벤트 수정' : '이벤트 추가'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="text-xs text-text-tertiary">이벤트명</label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="예: 여름 오픈 기념 무료"
              className="w-full h-10 px-3 border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary">이벤트 가격 (원, 0=무료)</label>
            <input
              type="number"
              value={eventPrice}
              onChange={e => setEventPrice(Number(e.target.value))}
              className="w-full h-10 px-3 border border-border rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary">시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg" />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">종료일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg" />
            </div>
          </div>
          <p className="text-[11px] text-text-tertiary">
            💡 예약 시 이벤트 기간이면 자동으로 이벤트 가격이 적용됩니다.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">취소</button>
          <button onClick={handleSubmit} disabled={busy}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50">
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}
