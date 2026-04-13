'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search } from 'lucide-react';
import { COUPON_STATUS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { Coupon, CouponIssue, Member } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

type IssueWithDetails = CouponIssue & { coupon?: Coupon; member?: Pick<Member, 'name' | 'phone'> };

export default function AdminCouponsPage() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [issues, setIssues] = useState<IssueWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'coupons' | 'issues'>('coupons');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', discount_type: 'percentage', discount_value: '', target_service: '', valid_until: '', max_issues: '' });
  const [saving, setSaving] = useState(false);
  const [searchCode, setSearchCode] = useState('');

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(c || []);
    const { data: i } = await supabase.from('coupon_issues').select('*, coupon:coupons(*), member:members(name, phone)').order('created_at', { ascending: false });
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

  const handleUse = async (issue: IssueWithDetails) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('coupon_issues').update({
      status: 'used', used_at: new Date().toISOString(), used_by: user?.id,
    }).eq('id', issue.id);
    if (error) toast.error('처리 실패'); else { toast.success('사용 처리되었습니다.'); fetchData(); }
  };

  const filteredIssues = searchCode ? issues.filter(i => i.coupon_code.includes(searchCode.toUpperCase())) : issues;

  if (loading) return <div className="py-10 text-center text-sm text-text-secondary">불러오는 중...</div>;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-bold text-text-primary tracking-tight">쿠폰 관리</h1></div>
        <div className="flex items-center gap-2">
          <ExportButton target={tab === 'issues' ? 'coupon_issues' : 'coupons'} params={tab === 'issues' ? { search: searchCode } : {}} dateField="created_at" />
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

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('coupons')} className={`px-4 py-2.5 text-sm font-medium relative ${tab === 'coupons' ? 'text-primary' : 'text-text-tertiary'}`}>
          쿠폰 목록 ({coupons.length}){tab === 'coupons' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button onClick={() => setTab('issues')} className={`px-4 py-2.5 text-sm font-medium relative ${tab === 'issues' ? 'text-primary' : 'text-text-tertiary'}`}>
          발급 현황 ({issues.length}){tab === 'issues' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {tab === 'coupons' ? (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-medium text-text-secondary">쿠폰명</th>
            <th className="px-4 py-3 font-medium text-text-secondary">할인</th>
            <th className="px-4 py-3 font-medium text-text-secondary">유효기간</th>
            <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
          </tr></thead><tbody>
            {coupons.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{c.name}<br/><span className="text-text-tertiary text-xs">{c.description}</span></td>
                <td className="px-4 py-3">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}</td>
                <td className="px-4 py-3 text-text-secondary text-xs">{c.valid_until || '-'}</td>
                <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${c.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>{c.is_active ? '활성' : '비활성'}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ) : (
        <>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
            <input type="text" value={searchCode} onChange={e => setSearchCode(e.target.value)} placeholder="쿠폰 코드 검색..."
              className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-secondary">코드</th>
              <th className="px-4 py-3 font-medium text-text-secondary">쿠폰명</th>
              <th className="px-4 py-3 font-medium text-text-secondary">회원</th>
              <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
              <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
            </tr></thead><tbody>
              {filteredIssues.map(i => {
                const status = COUPON_STATUS[i.status];
                return (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono font-bold tracking-wider">{i.coupon_code}</td>
                    <td className="px-4 py-3">{i.coupon?.name}</td>
                    <td className="px-4 py-3">{i.member?.name} <span className="text-text-tertiary text-xs">{i.member?.phone}</span></td>
                    <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span></td>
                    <td className="px-4 py-3">{i.status === 'issued' && <button onClick={() => handleUse(i)} className="px-2.5 py-1 text-[11px] rounded-md bg-green-light text-green hover:bg-green/10 font-medium">사용 처리</button>}</td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </>
      )}
    </div>
  );
}
