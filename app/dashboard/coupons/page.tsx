'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Coupon } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

export default function AdminCouponsPage() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [issues, setIssues] = useState<{ id: string; coupon_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', discount_type: 'percentage', discount_value: '', target_service: '', valid_until: '', max_issues: '' });
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(c || []);
    const { data: i } = await supabase.from('coupon_issues').select('id, coupon_id').order('created_at', { ascending: false });
    setIssues(i || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name || !form.discount_value) { toast.error('이름과 할인값을 입력해주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('coupons').insert({
      name: form.name, description: form.description || null,
      discount_type: form.discount_type, discount_value: parseInt(form.discount_value),
      target_service: form.target_service || null,
      valid_until: form.valid_until || null,
      max_issues: form.max_issues ? parseInt(form.max_issues) : null,
    });
    if (error) toast.error('생성 실패'); else { toast.success('쿠폰이 생성되었습니다.'); setShowForm(false); fetchData(); }
    setSaving(false);
  };

  const toggleActive = async (coupon: Coupon) => {
    await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    toast.success(coupon.is_active ? '비활성화되었습니다.' : '활성화되었습니다.'); fetchData();
    setMenuOpen(null);
  };

  const handleDelete = async (coupon: Coupon) => {
    const issuedCount = issues.filter(i => i.coupon_id === coupon.id).length;
    if (issuedCount > 0) { toast.error('발급 이력이 있는 쿠폰은 삭제할 수 없습니다.'); setDeleteConfirm(null); return; }
    await supabase.from('coupons').delete().eq('id', coupon.id);
    toast.success('삭제되었습니다.'); fetchData();
    setDeleteConfirm(null);
  };

  const getIssuedCount = (couponId: string) => issues.filter(i => i.coupon_id === couponId).length;

  if (loading) return <div className="py-10 text-center text-sm text-text-secondary">불러오는 중...</div>;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">쿠폰 설정</h1>
          <p className="text-sm text-text-secondary mt-1">쿠폰 템플릿을 관리합니다 · 발급 현황은 <a href="/dashboard/requests?type=coupon" className="text-primary hover:underline">신청관리</a>에서 확인</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="coupons" dateField="created_at" />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
            <Plus className="size-4" /> 쿠폰 생성
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">새 쿠폰 생성</h3>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="쿠폰명 *"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="설명"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value})}
              className="border border-border rounded-xl px-4 py-2.5 text-sm"><option value="percentage">%</option><option value="fixed">원</option></select>
            <input type="number" value={form.discount_value} onChange={e => setForm({...form, discount_value: e.target.value})} placeholder="할인값 *"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <input type="date" value={form.valid_until} onChange={e => setForm({...form, valid_until: e.target.value})}
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">{saving ? '생성 중...' : '생성'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
          <th className="px-4 py-3 font-medium text-text-secondary">쿠폰명</th>
          <th className="px-4 py-3 font-medium text-text-secondary">할인</th>
          <th className="px-4 py-3 font-medium text-text-secondary">유효기간</th>
          <th className="px-4 py-3 font-medium text-text-secondary">발급수</th>
          <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
          <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
        </tr></thead><tbody>
          {coupons.map(c => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
              <td className="px-4 py-3 font-medium">{c.name}<br/><span className="text-text-tertiary text-xs">{c.description}</span></td>
              <td className="px-4 py-3">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}</td>
              <td className="px-4 py-3 text-text-secondary text-xs">{c.valid_until || '-'}</td>
              <td className="px-4 py-3 text-text-secondary text-xs">{getIssuedCount(c.id)}건</td>
              <td className="px-4 py-3">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  !c.is_active ? 'text-gray bg-gray-light' :
                  (c.valid_until && new Date(c.valid_until) < new Date()) ? 'text-red bg-red-light' :
                  'text-green bg-green-light'
                }`}>{!c.is_active ? '비활성' : (c.valid_until && new Date(c.valid_until) < new Date()) ? '만료' : '활성'}</span>
              </td>
              <td className="px-4 py-3">
                <div className="relative">
                  <button onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)} className="p-1.5 hover:bg-accent rounded-md">
                    <MoreHorizontal className="size-4 text-text-secondary" />
                  </button>
                  {menuOpen === c.id && (
                    <div className="absolute right-0 top-8 z-20 bg-card border rounded-xl shadow-lg py-1 w-32">
                      <button onClick={() => toggleActive(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                        {c.is_active ? '비활성화' : '활성화'}
                      </button>
                      {getIssuedCount(c.id) === 0 ? (
                        <button onClick={() => { setDeleteConfirm(c); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-red">삭제</button>
                      ) : (
                        <span className="block px-3 py-2 text-xs text-text-tertiary">발급이력 있어 삭제 불가</span>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-2xl p-6 w-80 space-y-4 shadow-xl">
            <h3 className="text-base font-bold">쿠폰 삭제</h3>
            <p className="text-sm text-text-secondary">&ldquo;{deleteConfirm.name}&rdquo;을 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-border rounded-xl text-sm">취소</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red text-white rounded-xl text-sm font-medium">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
