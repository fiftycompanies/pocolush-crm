'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTimeSlots } from '@/lib/use-time-slots';
import { auditLog } from '@/lib/audit-log';
import toast from 'react-hot-toast';
import type { BBQFacility, BBQTimeSlot } from '@/types';

export default function BBQSettingsPage() {
  const supabase = createClient();

  // ─── 시설 상태 ───
  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BBQFacility | null>(null);
  const [form, setForm] = useState({ name: '', price: '30000', notes: '' });
  const [saving, setSaving] = useState(false);

  // ─── 타임슬롯 상태 ───
  const { timeSlots, refetch: refetchSlots } = useTimeSlots();
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<BBQTimeSlot | null>(null);
  const [slotForm, setSlotForm] = useState({ label: '', startTime: '', endTime: '', sortOrder: '0' });
  const [savingSlot, setSavingSlot] = useState(false);

  // ─── 시설 CRUD ───
  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase.from('bbq_facilities').select('*').order('number');
    setFacilities(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const nextNumber = facilities.length > 0 ? Math.max(...facilities.map(f => f.number)) + 1 : 1;

  const openNew = () => {
    setEditing(null);
    setForm({ name: `바베큐장 ${nextNumber}`, price: '30000', notes: '' });
    setShowForm(true);
    setShowSlotForm(false);
  };

  const openEdit = (f: BBQFacility) => {
    setEditing(f);
    setForm({ name: f.name, price: f.price.toString(), notes: f.notes || '' });
    setShowForm(true);
    setShowSlotForm(false);
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

  // ─── 타임슬롯 CRUD ───
  const nextSlotNumber = timeSlots.length > 0 ? Math.max(...timeSlots.map(s => s.slot_number)) + 1 : 1;

  const openNewSlot = () => {
    setEditingSlot(null);
    setSlotForm({ label: `${nextSlotNumber}타임`, startTime: '', endTime: '', sortOrder: String(nextSlotNumber) });
    setShowSlotForm(true);
    setShowForm(false);
  };

  const openEditSlot = (s: BBQTimeSlot) => {
    setEditingSlot(s);
    setSlotForm({
      label: s.label,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      sortOrder: String(s.sort_order),
    });
    setShowSlotForm(true);
    setShowForm(false);
  };

  const handleSaveSlot = async () => {
    if (!slotForm.label || !slotForm.startTime || !slotForm.endTime) {
      toast.error('라벨, 시작 시간, 종료 시간을 입력해주세요.');
      return;
    }
    if (slotForm.startTime >= slotForm.endTime) {
      toast.error('시작 시간이 종료 시간보다 빨라야 합니다.');
      return;
    }
    setSavingSlot(true);

    if (editingSlot) {
      const { error } = await supabase.from('bbq_time_slots').update({
        label: slotForm.label,
        start_time: slotForm.startTime,
        end_time: slotForm.endTime,
        sort_order: parseInt(slotForm.sortOrder) || 0,
      }).eq('id', editingSlot.id);
      if (error) { toast.error('수정 실패: ' + error.message); setSavingSlot(false); return; }
      await auditLog({
        action: 'update_bbq_time_slot',
        resource_type: 'bbq_time_slot',
        resource_id: editingSlot.id,
        metadata: { label: slotForm.label, start_time: slotForm.startTime, end_time: slotForm.endTime },
      });
      toast.success('타임 슬롯이 수정되었습니다.');
    } else {
      const { data, error } = await supabase.from('bbq_time_slots').insert({
        slot_number: nextSlotNumber,
        label: slotForm.label,
        start_time: slotForm.startTime,
        end_time: slotForm.endTime,
        sort_order: parseInt(slotForm.sortOrder) || nextSlotNumber,
      }).select().single();
      if (error) { toast.error('추가 실패: ' + error.message); setSavingSlot(false); return; }
      await auditLog({
        action: 'create_bbq_time_slot',
        resource_type: 'bbq_time_slot',
        resource_id: (data as { id: string }).id,
        metadata: { slot_number: nextSlotNumber, label: slotForm.label },
      });
      toast.success('타임 슬롯이 추가되었습니다.');
    }
    setSavingSlot(false);
    setShowSlotForm(false);
    refetchSlots();
  };

  const toggleSlotActive = async (slot: BBQTimeSlot) => {
    const activeSlotCount = timeSlots.filter(s => s.is_active).length;
    if (slot.is_active && activeSlotCount <= 1) {
      toast.error('최소 1개의 활성 타임 슬롯이 필요합니다.');
      return;
    }
    await supabase.from('bbq_time_slots').update({ is_active: !slot.is_active }).eq('id', slot.id);
    await auditLog({
      action: slot.is_active ? 'deactivate_bbq_time_slot' : 'activate_bbq_time_slot',
      resource_type: 'bbq_time_slot',
      resource_id: slot.id,
      metadata: { slot_number: slot.slot_number, label: slot.label, is_active: !slot.is_active },
    });
    toast.success(slot.is_active ? '타임 슬롯 비활성화됨' : '타임 슬롯 활성화됨');
    refetchSlots();
  };

  const handleDeleteSlot = async (slot: BBQTimeSlot) => {
    if (!confirm(`"${slot.label}" 타임 슬롯을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('bbq_time_slots').delete().eq('id', slot.id);
    if (error) {
      toast.error('예약 이력이 있어 삭제할 수 없습니다. 비활성화를 사용하세요.');
      return;
    }
    await auditLog({
      action: 'delete_bbq_time_slot',
      resource_type: 'bbq_time_slot',
      resource_id: slot.id,
      metadata: { slot_number: slot.slot_number, label: slot.label },
    });
    toast.success('타임 슬롯이 삭제되었습니다.');
    refetchSlots();
  };

  const activeCount = facilities.filter(f => f.is_active).length;
  const inputCls = 'border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary';

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

      {/* 시설 추가/수정 폼 */}
      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? '시설 수정' : '새 시설 추가'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="시설 이름 *" className={inputCls} />
            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="가격 *" className={inputCls} />
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="메모" className={inputCls} />
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
                f.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-50'
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

      {/* 타임 슬롯 CRUD */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">타임 슬롯</h3>
          <button onClick={openNewSlot} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
            <Plus className="size-3.5" /> 타임 추가
          </button>
        </div>

        {/* 타임슬롯 추가/수정 인라인 폼 */}
        {showSlotForm && (
          <div className="bg-muted/30 rounded-lg p-4 mb-3 space-y-3">
            <h4 className="text-xs font-semibold text-text-secondary">{editingSlot ? '타임 수정' : '새 타임 추가'}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">라벨 *</label>
                <input type="text" value={slotForm.label} onChange={e => setSlotForm({...slotForm, label: e.target.value})} placeholder="예: 4타임" className={inputCls + ' w-full'} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">시작 시간 *</label>
                <input type="time" value={slotForm.startTime} onChange={e => setSlotForm({...slotForm, startTime: e.target.value})} className={inputCls + ' w-full'} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">종료 시간 *</label>
                <input type="time" value={slotForm.endTime} onChange={e => setSlotForm({...slotForm, endTime: e.target.value})} className={inputCls + ' w-full'} />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">정렬 순서</label>
                <input type="number" value={slotForm.sortOrder} onChange={e => setSlotForm({...slotForm, sortOrder: e.target.value})} className={inputCls + ' w-full'} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveSlot} disabled={savingSlot} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">
                {savingSlot ? '저장 중...' : editingSlot ? '수정' : '추가'}
              </button>
              <button onClick={() => setShowSlotForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
            </div>
          </div>
        )}

        {/* 타임슬롯 리스트 */}
        <div className="space-y-2">
          {timeSlots.map(slot => (
            <div key={slot.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary">{slot.label}</span>
                <span className="text-xs text-text-secondary">{slot.start_time.slice(0, 5)} ~ {slot.end_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mr-1 ${slot.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>
                  {slot.is_active ? '활성' : '비활성'}
                </span>
                <button onClick={() => toggleSlotActive(slot)} className="p-1.5 hover:bg-accent rounded-md" aria-label={slot.is_active ? '비활성화' : '활성화'}>
                  {slot.is_active ? <ToggleRight className="size-4 text-green" /> : <ToggleLeft className="size-4 text-gray" />}
                </button>
                <button onClick={() => openEditSlot(slot)} className="p-1.5 hover:bg-accent rounded-md" aria-label="수정"><Edit3 className="size-3.5 text-text-secondary" /></button>
                <button onClick={() => handleDeleteSlot(slot)} className="p-1.5 hover:bg-accent rounded-md" aria-label="삭제"><Trash2 className="size-3.5 text-red" /></button>
              </div>
            </div>
          ))}
          {timeSlots.length === 0 && (
            <p className="text-sm text-text-tertiary py-4 text-center">등록된 타임 슬롯이 없습니다.</p>
          )}
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
