'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { PRODUCT_CATEGORIES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { StoreProduct, ServiceOrder } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

const ORDER_TABS = [
  { key: '', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'processing', label: '처리중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
] as const;

export default function AdminStorePage() {
  const supabase = createClient();
  const [mainTab, setMainTab] = useState<'products' | 'orders'>('products');

  // 상품 관리
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'service', sort_order: '0' });
  const [saving, setSaving] = useState(false);

  // 신청 관리
  const [orders, setOrders] = useState<(ServiceOrder & { member?: { name: string; phone: string }; product?: { name: string } })[]>([]);
  const [ordLoading, setOrdLoading] = useState(true);
  const [orderTab, setOrderTab] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('store_products').select('*').order('sort_order');
    setProducts(data || []);
    setProdLoading(false);
  }, [supabase]);

  const fetchOrders = useCallback(async () => {
    setOrdLoading(true);
    let query = supabase.from('service_orders')
      .select('*, member:members(name, phone), product:store_products(name)')
      .order('created_at', { ascending: false });
    if (orderTab) query = query.eq('status', orderTab);
    const { data } = await query;
    setOrders(data || []);
    setOrdLoading(false);
  }, [supabase, orderTab]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // 상품 CRUD
  const openNew = () => { setEditing(null); setForm({ name: '', description: '', price: '', category: 'service', sort_order: '0' }); setShowForm(true); };
  const openEdit = (p: StoreProduct) => { setEditing(p); setForm({ name: p.name, description: p.description || '', price: p.price.toString(), category: p.category, sort_order: p.sort_order.toString() }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('이름과 가격을 입력해주세요.'); return; }
    setSaving(true);
    const data = { name: form.name, description: form.description || null, price: parseInt(form.price), category: form.category, sort_order: parseInt(form.sort_order || '0') };
    if (editing) {
      const { error } = await supabase.from('store_products').update(data).eq('id', editing.id);
      if (error) toast.error('수정 실패'); else toast.success('상품이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('store_products').insert(data);
      if (error) toast.error('등록 실패'); else toast.success('상품이 등록되었습니다.');
    }
    setSaving(false); setShowForm(false); fetchProducts();
  };

  const toggleActive = async (p: StoreProduct) => {
    await supabase.from('store_products').update({ is_active: !p.is_active }).eq('id', p.id);
    toast.success(p.is_active ? '비활성화됨' : '활성화됨'); fetchProducts();
  };

  // 신청 관리
  const handleOrderStatus = async (id: string, status: string) => {
    const update: Record<string, unknown> = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('service_orders').update(update).eq('id', id);
    if (error) toast.error('변경 실패'); else { toast.success('상태가 변경되었습니다.'); fetchOrders(); }
  };

  const handlePayment = async (id: string, paymentStatus: string) => {
    const { error } = await supabase.from('service_orders').update({ payment_status: paymentStatus }).eq('id', id);
    if (error) toast.error('변경 실패'); else { toast.success('결제 상태가 변경되었습니다.'); fetchOrders(); }
  };

  const filteredOrders = orders.filter(o => {
    if (!orderSearch) return true;
    const q = orderSearch.toLowerCase();
    return o.member?.name?.toLowerCase().includes(q) || o.member?.phone?.includes(q);
  });

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">스토어 관리</h1>
          <p className="text-sm text-text-secondary mt-1">상품 {products.length}개 · 신청 {orders.length}건</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target={mainTab === 'orders' ? 'orders' : 'products'} dateField="created_at" />
          {mainTab === 'products' && (
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
              <Plus className="size-4" /> 상품 추가
            </button>
          )}
        </div>
      </div>

      {/* 메인 탭: 상품 관리 / 신청 관리 */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setMainTab('products')}
          className={`px-4 py-2.5 text-sm font-medium relative ${mainTab === 'products' ? 'text-primary' : 'text-text-tertiary'}`}>
          상품 관리 ({products.length})
          {mainTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button onClick={() => setMainTab('orders')}
          className={`px-4 py-2.5 text-sm font-medium relative ${mainTab === 'orders' ? 'text-primary' : 'text-text-tertiary'}`}>
          신청 관리 ({orders.length})
          {mainTab === 'orders' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {/* ═══ 상품 관리 탭 ═══ */}
      {mainTab === 'products' && (
        <>
          {showForm && (
            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">{editing ? '상품 수정' : '새 상품 등록'}</h3>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="상품명 *"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="설명"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              <div className="grid grid-cols-3 gap-3">
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="가격 *"
                  className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
                  {Object.entries(PRODUCT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: e.target.value})} placeholder="정렬순서"
                  className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">{saving ? '저장 중...' : '저장'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
              </div>
            </div>
          )}

          {prodLoading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-text-secondary">상품명</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">카테고리</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">가격</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
                </tr></thead>
                <tbody>
                  {products.map(p => {
                    const cat = PRODUCT_CATEGORIES[p.category];
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-text-secondary">{cat?.emoji} {cat?.label}</td>
                        <td className="px-4 py-3">{p.price.toLocaleString()}원</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
                            {p.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></button>
                            <button onClick={() => toggleActive(p)} className="p-1.5 hover:bg-accent rounded-md">
                              {p.is_active ? <ToggleRight className="size-4 text-green" /> : <ToggleLeft className="size-4 text-gray" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ 신청 관리 탭 ═══ */}
      {mainTab === 'orders' && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 border-b border-border flex-1">
              {ORDER_TABS.map(t => (
                <button key={t.key} onClick={() => setOrderTab(t.key)}
                  className={`px-4 py-2.5 text-sm font-medium relative ${orderTab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
                  {t.label}{orderTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              ))}
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
              <input type="text" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="신청자명 / 연락처..."
                className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
            </div>
          </div>

          {ordLoading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : filteredOrders.length === 0 ? (
            <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">신청 내역이 없습니다.</p></div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-text-secondary">신청자</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">연락처</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">상품</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">금액</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">신청일</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">결제</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
                </tr></thead>
                <tbody>
                  {filteredOrders.map(o => {
                    const status = ORDER_STATUS[o.status];
                    return (
                      <tr key={o.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{o.member?.name || '-'}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{o.member?.phone || '-'}</td>
                        <td className="px-4 py-3">{o.product?.name || '-'}</td>
                        <td className="px-4 py-3">{o.total_price.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            o.payment_status === '납부완료' ? 'text-green bg-green-light' :
                            o.payment_status === '미납' ? 'text-red bg-red-light' :
                            'text-yellow bg-yellow-light'
                          }`}>{o.payment_status || '대기'}</span>
                        </td>
                        <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {o.payment_status !== '납부완료' && (
                              <button onClick={() => handlePayment(o.id, '납부완료')} className="px-2 py-1 text-[11px] rounded-md bg-green-light text-green font-medium">결제확인</button>
                            )}
                            {o.status === 'pending' && <button onClick={() => handleOrderStatus(o.id, 'processing')} className="px-2 py-1 text-[11px] rounded-md bg-blue-light text-blue">처리시작</button>}
                            {o.status === 'processing' && <button onClick={() => handleOrderStatus(o.id, 'completed')} className="px-2 py-1 text-[11px] rounded-md bg-green-light text-green">완료</button>}
                            {(o.status === 'pending' || o.status === 'processing') && (
                              <button onClick={() => handleOrderStatus(o.id, 'cancelled')} className="px-2 py-1 text-[11px] rounded-md bg-red-light text-red">취소</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
