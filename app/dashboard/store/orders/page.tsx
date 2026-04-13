'use client';

import { useState } from 'react';
import { useAdminOrders } from '@/lib/use-admin-member-data';
import { ORDER_STATUS } from '@/lib/member-constants';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import ExportButton from '@/components/ui/ExportButton';

const TABS = [
  { key: '', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'processing', label: '처리중' },
  { key: 'completed', label: '완료' },
] as const;

export default function AdminOrdersPage() {
  const [tab, setTab] = useState('');
  const { orders, loading, refetch } = useAdminOrders(tab || undefined);
  const supabase = createClient();

  const handleStatus = async (id: string, status: string) => {
    const update: Record<string, unknown> = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('service_orders').update(update).eq('id', id);
    if (error) toast.error('변경 실패'); else { toast.success('상태가 변경되었습니다.'); refetch(); }
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">서비스 신청 관리</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {orders.length}건</p>
        </div>
        <ExportButton target="orders" params={{ status: tab }} />
      </div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium relative ${tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
            {t.label}{tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>
      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : orders.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">신청 내역이 없습니다.</p></div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-secondary">신청자</th>
              <th className="px-4 py-3 font-medium text-text-secondary">상품</th>
              <th className="px-4 py-3 font-medium text-text-secondary">금액</th>
              <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
              <th className="px-4 py-3 font-medium text-text-secondary">신청일</th>
              <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
            </tr></thead>
            <tbody>
              {orders.map(o => {
                const status = ORDER_STATUS[o.status];
                return (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{o.member?.name || '-'}</td>
                    <td className="px-4 py-3">{o.product?.name || '-'}</td>
                    <td className="px-4 py-3">{o.total_price.toLocaleString()}원</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span></td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      {o.status === 'pending' && <button onClick={() => handleStatus(o.id, 'processing')} className="px-2 py-1 text-[11px] rounded-md bg-blue-light text-blue">처리시작</button>}
                      {o.status === 'processing' && <button onClick={() => handleStatus(o.id, 'completed')} className="px-2 py-1 text-[11px] rounded-md bg-green-light text-green">완료</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
