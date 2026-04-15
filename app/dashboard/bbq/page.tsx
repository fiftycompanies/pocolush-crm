'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { TIME_SLOTS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { BBQFacility } from '@/types';

export default function BBQSettingsPage() {
  const supabase = createClient();
  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BBQFacility | null>(null);
  const [form, setForm] = useState({ name: '', price: '30000', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase.from('bbq_facilities').select('*').order('number');
    setFacilities(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const nextNumber = facilities.length > 0 ? Math.max(...facilities.map(f => f.number)) + 1 : 1;

  const openNew = () => {
    setEditing(null);
    setForm({ name: `바베큐장 ${nextNumber}`, price: '30000', notes: '' });
    setShowForm(true);
  };

  const openEdit = (f: BBQFacility) => {
    setEditing(f);
    setForm({ name: f.name, price: f.price.toString(), notes: f.notes || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('이름과 가격을 입력해주세요.'); return; }
    setSaving(true);
    if (editing) {
      await supabase.from('bbq_facilities').update({ name: form.name, price: parseInt(form.price), notes: form.notes || null }).eq('id', editing.id);
      toast.success('시설이 수정되었습니다.');
    } else {
      await supabase.from('bbq_facilities').insert({ number: nextNumber, name: form.name, price: parseInt(form.price), notes: form.notes || null });
      toast.success('시설이 추가되었습니다.');
    }
    setSaving(false); setShowForm(false); fetchFacilities();
  };

  const toggleActive = async (f: BBQFacility) => {
    await supabase.from('bbq_facilities').update({ is_active: !f.is_active }).eq('id', f.id);
    toast.success(f.is_active ? '비활성화됨' : '활성화됨'); fetchFacilities();
  };

  const handleDelete = async (f: BBQFacility) => {
    if (!confirm(`"${f.name}" 시설을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('bbq_facilities').delete().eq('id', f.id);
    if (error) toast.error('예약 이력이 있어 삭제할 수 없습니다.');
    else { toast.success('삭제되었습니다.'); fetchFacilities(); }
  };

  const activeCount = facilities.filter(f => f.is_active).length;

  return (
    <div className="space-y-6" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">바베큐장 설정</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {facilities.length}개 · 활성 {activeCount}개</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
          <Plus className="size-4" /> 시설 추가
        </button>
      </div>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? '시설 수정' : '새 시설 추가'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="시설 이름 *"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="가격 *"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="메모"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">
              {saving ? '저장 중...' : editing ? '수정' : '추가'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
          </div>
        </div>
      )}

      {/* 배치도 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">바베큐장 배치도</h3>
          <span className="text-xs text-muted-foreground">{activeCount}개 운영중</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {facilities.map(f => (
            <button key={f.id} onClick={() => openEdit(f)}
              className={`rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border ${
                f.is_active
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${f.is_active ? 'text-green-700' : 'text-gray-500'}`}>{f.number}번</span>
                <div className={`size-2 rounded-full ${f.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
              <p className="text-xs font-medium truncate">{f.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.price.toLocaleString()}원</p>
            </button>
          ))}
        </div>
      </div>

      {/* 타임 슬롯 */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-3">타임 슬롯</h3>
        <div className="space-y-2">
          {Object.entries(TIME_SLOTS).map(([key, slot]) => (
            <div key={key} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary">{slot.label}</span>
                <span className="text-xs text-text-secondary">{slot.time}</span>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-green bg-green-light">활성</span>
            </div>
          ))}
        </div>
      </div>

      {/* 시설 목록 테이블 */}
      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-secondary">번호</th>
              <th className="px-4 py-3 font-medium text-text-secondary">이름</th>
              <th className="px-4 py-3 font-medium text-text-secondary">가격</th>
              <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
              <th className="px-4 py-3 font-medium text-text-secondary">메모</th>
              <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
            </tr></thead>
            <tbody>
              {facilities.map(f => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{f.number}번</td>
                  <td className="px-4 py-3">{f.name}</td>
                  <td className="px-4 py-3">{f.price.toLocaleString()}원</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${f.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
                      {f.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{f.notes || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(f)} className="p-1.5 hover:bg-accent rounded-md">
                        {f.is_active ? <ToggleRight className="size-4 text-green" /> : <ToggleLeft className="size-4 text-gray" />}
                      </button>
                      <button onClick={() => openEdit(f)} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></button>
                      <button onClick={() => handleDelete(f)} className="p-1.5 hover:bg-accent rounded-md"><Trash2 className="size-3.5 text-red" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
