'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan } from '@/types';

export default function PlansPage() {
  const supabase = createClient();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: '', description: '', plots: '1', price: '', duration_months: '12' });
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    setPlans(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', plots: '1', price: '', duration_months: '12' }); setShowForm(true); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', plots: p.plots.toString(), price: p.price.toString(), duration_months: p.duration_months.toString() });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('이름과 가격을 입력해주세요.'); return; }
    setSaving(true);
    const data = {
      name: form.name, description: form.description || null,
      plots: parseInt(form.plots), price: parseInt(form.price),
      duration_months: parseInt(form.duration_months),
    };
    if (editing) {
      const { error } = await supabase.from('plans').update(data).eq('id', editing.id);
      if (error) toast.error('수정 실패'); else toast.success('플랜이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('plans').insert(data);
      if (error) toast.error('등록 실패'); else toast.success('플랜이 등록되었습니다.');
    }
    setSaving(false); setShowForm(false); fetchPlans();
  };

  const toggleActive = async (p: Plan) => {
    await supabase.from('plans').update({ is_active: !p.is_active }).eq('id', p.id);
    toast.success(p.is_active ? '비활성화됨' : '활성화됨'); fetchPlans();
  };

  const handleDelete = async (p: Plan) => {
    if (!confirm(`"${p.name}" 플랜을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('plans').delete().eq('id', p.id);
    if (error) toast.error('삭제 실패'); else { toast.success('삭제되었습니다.'); fetchPlans(); }
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">플랜 관리</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {plans.length}건</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
          <Plus className="size-4" /> 플랜 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? '플랜 수정' : '새 플랜 생성'}</h3>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="플랜명 *"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="설명"
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">구좌 수</label>
              <input type="number" value={form.plots} onChange={e => setForm({...form, plots: e.target.value})}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">가격 (원) *</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">기간 (개월)</label>
              <input type="number" value={form.duration_months} onChange={e => setForm({...form, duration_months: e.target.value})}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">
              {saving ? '저장 중...' : editing ? '수정' : '생성'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : plans.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">등록된 플랜이 없습니다.</p></div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-medium text-text-secondary">플랜명</th>
            <th className="px-4 py-3 font-medium text-text-secondary">구좌</th>
            <th className="px-4 py-3 font-medium text-text-secondary">가격</th>
            <th className="px-4 py-3 font-medium text-text-secondary">기간</th>
            <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
            <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
          </tr></thead><tbody>
            {plans.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{p.name}<br/><span className="text-text-tertiary text-xs">{p.description}</span></td>
                <td className="px-4 py-3">{p.plots}평</td>
                <td className="px-4 py-3">{p.price.toLocaleString()}원</td>
                <td className="px-4 py-3">{p.duration_months}개월</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
                    {p.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggleActive(p)} className="p-1.5 hover:bg-accent rounded-md" title={p.is_active ? '비활성화' : '활성화'}>
                      {p.is_active ? <ToggleRight className="size-4 text-green" /> : <ToggleLeft className="size-4 text-gray" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 hover:bg-accent rounded-md"><Trash2 className="size-3.5 text-red" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
