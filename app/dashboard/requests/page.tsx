'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Flame, ShoppingBag, Ticket, Search, X, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRequests, type RequestType, type UnifiedStatus } from '@/lib/use-requests';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { auditLog } from '@/lib/audit-log';

const TYPE_TABS = [
  { key: '', label: '전체' },
  { key: 'bbq', label: 'BBQ', icon: Flame, color: '#DC2626' },
  { key: 'order', label: '스토어', icon: ShoppingBag, color: '#D97706' },
  { key: 'coupon', label: '쿠폰', icon: Ticket, color: '#8B5CF6' },
] as const;

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'payment_pending', label: '결제 필요' },
  { key: 'pending', label: '대기' },
  { key: 'processing', label: '처리중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
] as const;

const TYPE_META: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  bbq: { icon: Flame, color: '#DC2626', label: 'BBQ' },
  order: { icon: ShoppingBag, color: '#D97706', label: '스토어' },
  coupon: { icon: Ticket, color: '#8B5CF6', label: '쿠폰' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  payment_pending: { label: '결제 필요', color: '#DC2626', bg: '#FEF2F2' },
  pending: { label: '대기', color: '#D97706', bg: '#FFFBEB' },
  processing: { label: '처리중', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: '완료', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
};

export default function RequestsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const urlType = searchParams.get('type') || '';
  const urlStatus = searchParams.get('status') || '';

  const [typeFilter, setTypeFilter] = useState(urlType);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [search, setSearch] = useState('');
  const [bankInfoOpen, setBankInfoOpen] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<{ bank_name?: string; bank_account?: string; bank_holder?: string; bank_note?: string }>({});

  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', ['bank_name', 'bank_account', 'bank_holder', 'bank_note']).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      setBankInfo(map);
    });
  }, [supabase]);

  const openBankInfo = async (orderId: string) => {
    setBankInfoOpen(orderId);
    await auditLog({
      action: 'view_payment_info',
      resource_type: 'service_order',
      resource_id: orderId,
    });
  };

  useEffect(() => {
    setTypeFilter(searchParams.get('type') || '');
    setStatusFilter(searchParams.get('status') || '');
  }, [searchParams]);

  const { items, loading, refetch } = useRequests(typeFilter || undefined, statusFilter || undefined);

  const updateURL = (type: string, status: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    const qs = params.toString();
    router.replace(`/dashboard/requests${qs ? '?' + qs : ''}`, { scroll: false });
  };

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    updateURL(type, statusFilter);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    updateURL(typeFilter, status);
  };

  // 인라인 액션: BBQ 상태변경
  const handleBBQStatus = async (id: string, status: string) => {
    const update: Record<string, unknown> = { status };
    if (status === 'cancelled') update.cancelled_at = new Date().toISOString();
    await supabase.from('bbq_reservations').update(update).eq('id', id);
    toast.success('상태가 변경되었습니다.'); refetch();
  };

  // 인라인 액션: 스토어 주문 상태변경
  const handleOrderStatus = async (id: string, status: string) => {
    const update: Record<string, unknown> = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    await supabase.from('service_orders').update(update).eq('id', id);
    toast.success('상태가 변경되었습니다.'); refetch();
  };

  // 인라인 액션: 스토어 결제확인
  const handlePayment = async (id: string, ps: string) => {
    await supabase.from('service_orders').update({ payment_status: ps }).eq('id', id);
    toast.success('결제 상태가 변경되었습니다.'); refetch();
  };

  // 인라인 액션: 쿠폰 사용처리
  const handleCouponUse = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('coupon_issues').update({ status: 'used', used_at: new Date().toISOString(), used_by: user?.id }).eq('id', id);
    toast.success('사용 처리되었습니다.'); refetch();
  };

  const filtered = items.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.memberName.toLowerCase().includes(q) || r.memberPhone.includes(q);
  });

  // 타입별 카운트
  const typeCounts = { bbq: 0, order: 0, coupon: 0 };
  items.forEach(i => { typeCounts[i.type]++; });

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">신청 관리</h1>
          <p className="text-sm text-text-secondary mt-1">BBQ · 스토어 · 쿠폰 신청을 통합 관리합니다</p>
        </div>
      </div>

      {/* 타입 필터 칩 */}
      <div className="flex items-center gap-2">
        {TYPE_TABS.map(t => {
          const count = t.key ? typeCounts[t.key as RequestType] : items.length;
          const Icon = t.key ? TYPE_META[t.key]?.icon : null;
          return (
            <button key={t.key} onClick={() => handleTypeChange(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                typeFilter === t.key
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-text-secondary hover:border-text-tertiary'
              }`}>
              {Icon && <Icon className="size-3.5" style={{ color: typeFilter === t.key ? undefined : TYPE_META[t.key]?.color }} />}
              {t.label}
              <span className="text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 상태 탭 + 검색 */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 border-b border-border flex-1">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => handleStatusChange(t.key)}
              className={`px-4 py-2.5 text-sm font-medium relative ${
                statusFilter === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'
              }`}>
              {t.label}
              {statusFilter === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="신청자명 / 연락처..."
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
        </div>
      </div>

      {/* 리스트 */}
      {loading ? (
        <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center">
          <p className="text-sm text-text-tertiary">해당하는 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-secondary w-20">구분</th>
              <th className="px-4 py-3 font-medium text-text-secondary">신청자</th>
              <th className="px-4 py-3 font-medium text-text-secondary">연락처</th>
              <th className="px-4 py-3 font-medium text-text-secondary">내용</th>
              <th className="px-4 py-3 font-medium text-text-secondary">날짜</th>
              <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
              <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => {
                const tm = TYPE_META[r.type];
                const sm = STATUS_META[r.unifiedStatus];
                const Icon = tm.icon;
                return (
                  <tr key={r.id + r.type} className="border-b border-border last:border-0 hover:bg-accent/30"
                    style={{ borderLeft: `3px solid ${tm.color}` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-3.5" style={{ color: tm.color }} />
                        <span className="text-xs font-medium" style={{ color: tm.color }}>{tm.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.memberName}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{r.memberPhone}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.detail}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{format(new Date(r.date), 'M.d HH:mm')}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ color: sm.color, backgroundColor: sm.bg }}>{sm.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {/* BBQ 액션 */}
                      {r.type === 'bbq' && r.rawStatus === 'confirmed' && (
                        <select defaultValue="" onChange={e => { if (e.target.value) handleBBQStatus(r.id, e.target.value); e.target.value = ''; }}
                          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary">
                          <option value="" disabled>변경</option>
                          <option value="completed">완료</option>
                          <option value="no_show">노쇼</option>
                          <option value="cancelled">취소</option>
                        </select>
                      )}
                      {/* 스토어 액션 */}
                      {r.type === 'order' && (r.rawStatus === 'payment_pending' || r.rawStatus === 'pending' || r.rawStatus === 'processing') && (
                        <div className="flex gap-1 flex-wrap">
                          <select defaultValue="" onChange={e => { if (e.target.value) handleOrderStatus(r.id, e.target.value); e.target.value = ''; }}
                            className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary">
                            <option value="" disabled>상태</option>
                            {(r.rawStatus === 'payment_pending' || r.rawStatus === 'pending') && <option value="processing">입금 확인 → 대기</option>}
                            <option value="completed">완료</option>
                            <option value="cancelled">취소</option>
                          </select>
                          {r.rawStatus === 'payment_pending' && (
                            <button onClick={() => openBankInfo(r.id)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium border border-red-200">계좌 안내</button>
                          )}
                          {r.paymentStatus !== '납부완료' && (
                            <button onClick={() => handlePayment(r.id, '납부완료')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-green-light text-green font-medium">결제 처리</button>
                          )}
                        </div>
                      )}
                      {/* 쿠폰 액션 */}
                      {r.type === 'coupon' && r.rawStatus === 'issued' && (
                        <button onClick={() => handleCouponUse(r.id)}
                          className="text-[10px] px-2 py-1 rounded-md bg-violet-100 text-violet-700 font-medium">사용처리</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 계좌 안내 팝업 */}
      {bankInfoOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setBankInfoOpen(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">결제 계좌 안내</h2>
              <button onClick={() => setBankInfoOpen(null)} className="p-1 hover:bg-accent rounded">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="bg-bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">은행</span>
                  <span className="font-medium">{bankInfo.bank_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{bankInfo.bank_account || '-'}</span>
                    <button
                      onClick={() => {
                        if (bankInfo.bank_account) {
                          navigator.clipboard.writeText(bankInfo.bank_account);
                          toast.success('복사됨');
                        }
                      }}
                      className="p-1 hover:bg-accent rounded"
                      title="복사"
                    >
                      <Copy className="size-3.5 text-text-tertiary" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">예금주</span>
                  <span className="font-medium">{bankInfo.bank_holder || '-'}</span>
                </div>
              </div>
              {bankInfo.bank_note && (
                <p className="text-xs text-text-secondary bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  💡 {bankInfo.bank_note}
                </p>
              )}
            </div>
            <div className="flex justify-end p-4 border-t border-border">
              <button
                onClick={() => setBankInfoOpen(null)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark"
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
