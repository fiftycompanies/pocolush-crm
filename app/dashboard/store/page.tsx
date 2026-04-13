'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, ToggleLeft, ToggleRight } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { StoreProduct } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

export default function AdminStorePage() {
  const supabase = createClient();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'service', sort_order: '0' });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('store_products').select('*').order('sort_order');
    setProducts(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

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
    setSaving(false); setShowForm(false); fetch();
  };

  const toggleActive = async (p: StoreProduct) => {
    await supabase.from('store_products').update({ is_active: !p.is_active }).eq('id', p.id);
    toast.success(p.is_active ? '비활성화됨' : '활성화됨'); fetch();
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">스토어 관리</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {products.length}개 상품</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="products" />
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
            <Plus className="size-4" /> 상품 추가
          </button>
        </div>
      </div>

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

      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : (
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
    </div>
  );
}
