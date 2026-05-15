'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BBQFacility } from '@/types';

interface Props {
  /** 부모에서 facilities + count 외부 노출 위해 콜백 — 헤더 KPI 표시에 사용 */
  onChange?: (data: { total: number; active: number; facilities: BBQFacility[] }) => void;
}

const inputCls =
  'border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary';

/**
 * §1 평상 배치도 섹션
 * - 시설 카드 grid (활성/비활성 색상)
 * - 시설 추가/수정 인라인 폼 (showForm)
 * - 외부 노출: onChange 콜백으로 facilities/count 부모에 알림
 */
export default function FacilitiesSection({ onChange }: Props) {
  const supabase = createClient();

  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BBQFacility | null>(null);
  const [form, setForm] = useState({ name: '', price: '30000', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase.from('bbq_facilities').select('*').order('number');
    const list = data || [];
    setFacilities(list);
    onChange?.({
      total: list.length,
      active: list.filter((f) => f.is_active).length,
      facilities: list,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const nextNumber =
    facilities.length > 0 ? Math.max(...facilities.map((f) => f.number)) + 1 : 1;
  const activeCount = facilities.filter((f) => f.is_active).length;

  const openNew = () => {
    setEditing(null);
    setForm({ name: `평상 ${nextNumber}`, price: '30000', notes: '' });
    setShowForm(true);
  };

  const openEdit = (f: BBQFacility) => {
    setEditing(f);
    setForm({ name: f.name, price: f.price.toString(), notes: f.notes || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error('이름과 가격을 입력해주세요.');
      return;
    }
    setSaving(true);
    if (editing) {
      await supabase
        .from('bbq_facilities')
        .update({
          name: form.name,
          price: parseInt(form.price),
          notes: form.notes || null,
        })
        .eq('id', editing.id);
      toast.success('시설이 수정되었습니다.');
    } else {
      await supabase.from('bbq_facilities').insert({
        number: nextNumber,
        name: form.name,
        price: parseInt(form.price),
        notes: form.notes || null,
      });
      toast.success('시설이 추가되었습니다.');
    }
    setSaving(false);
    setShowForm(false);
    fetchFacilities();
  };

  return (
    <section className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">평상 배치도</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            전체 {facilities.length}개 · 활성 {activeCount}개
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-dark"
        >
          <Plus className="size-3.5" /> 시설 추가
        </button>
      </div>

      {showForm && (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
          <h4 className="text-xs font-semibold text-text-secondary">
            {editing ? '시설 수정' : '새 시설 추가'}
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="시설 이름 *"
              className={inputCls}
            />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="가격 *"
              className={inputCls}
            />
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="메모"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {saving ? '저장 중...' : editing ? '수정' : '추가'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {facilities.map((f) => (
          <button
            key={f.id}
            onClick={() => openEdit(f)}
            className={`rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border ${
              f.is_active
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200 opacity-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-sm font-bold ${f.is_active ? 'text-green-700' : 'text-gray-500'}`}
              >
                {f.number}번
              </span>
              <div
                className={`size-2 rounded-full ${f.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
              />
            </div>
            <p className="text-xs font-medium truncate">{f.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {f.price.toLocaleString()}원
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
