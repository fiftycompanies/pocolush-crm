'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { auditLog } from '@/lib/audit-log';
import type { BbqProduct } from './BbqProductsPageClient';

interface Props {
  mode: 'new' | 'edit';
  product?: BbqProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BbqProductModal({ mode, product, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(product?.name ?? '');
  const [basePrice, setBasePrice] = useState(product?.base_price ?? 30000);
  const [durationMinutes, setDurationMinutes] = useState(product?.duration_minutes ?? 170);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('상품명을 입력하세요');
      return;
    }
    setBusy(true);
    if (mode === 'new') {
      const { data, error } = await supabase.from('bbq_products').insert({
        name: name.trim(),
        base_price: basePrice,
        duration_minutes: durationMinutes,
        is_active: isActive,
      }).select().single();
      if (error) { toast.error('등록 실패: ' + error.message); setBusy(false); return; }
      await auditLog({
        action: 'create_bbq_product',
        resource_type: 'bbq_product',
        resource_id: (data as { id: string }).id,
        metadata: { name, base_price: basePrice },
      });
      toast.success('상품이 등록되었습니다');
    } else if (product) {
      const { error } = await supabase.from('bbq_products').update({
        name: name.trim(),
        base_price: basePrice,
        duration_minutes: durationMinutes,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) { toast.error('수정 실패: ' + error.message); setBusy(false); return; }
      await auditLog({
        action: 'update_bbq_product',
        resource_type: 'bbq_product',
        resource_id: product.id,
        metadata: { name, base_price: basePrice },
      });
      toast.success('상품이 수정되었습니다');
    }
    setBusy(false);
    onSuccess();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold">{mode === 'new' ? '신규 상품' : '상품 수정'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="text-xs text-text-tertiary">상품명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 바베큐장 예약 (4인 기준)"
              className="w-full h-10 px-3 border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary">기본 가격 (원)</label>
            <input
              type="number"
              value={basePrice}
              onChange={e => setBasePrice(Number(e.target.value))}
              className="w-full h-10 px-3 border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary">이용 시간 (분)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full h-10 px-3 border border-border rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span className="text-sm">활성 상태 (예약 가능)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">취소</button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}
