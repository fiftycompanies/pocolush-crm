'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTimeSlots } from '@/lib/use-time-slots';
import { auditLog } from '@/lib/audit-log';
import toast from 'react-hot-toast';
import type { BBQTimeSlot } from '@/types';

interface Props {
  /** 외부 노출: slots count */
  onChange?: (data: { total: number; active: number }) => void;
}

const inputCls =
  'border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary';

/**
 * §2 타임 슬롯 섹션
 * - 타임 슬롯 CRUD (라벨/시작/종료/정렬)
 * - 인라인 추가/수정 폼
 */
export default function TimeSlotsSection({ onChange }: Props) {
  const supabase = createClient();
  const { timeSlots, refetch: refetchSlots } = useTimeSlots();

  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<BBQTimeSlot | null>(null);
  const [slotForm, setSlotForm] = useState({
    label: '',
    startTime: '',
    endTime: '',
    sortOrder: '0',
  });
  const [savingSlot, setSavingSlot] = useState(false);

  useEffect(() => {
    onChange?.({
      total: timeSlots.length,
      active: timeSlots.filter((s) => s.is_active).length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSlots]);

  const nextSlotNumber =
    timeSlots.length > 0 ? Math.max(...timeSlots.map((s) => s.slot_number)) + 1 : 1;

  const openNewSlot = () => {
    setEditingSlot(null);
    setSlotForm({
      label: `${nextSlotNumber}타임`,
      startTime: '',
      endTime: '',
      sortOrder: String(nextSlotNumber),
    });
    setShowSlotForm(true);
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
      const { error } = await supabase
        .from('bbq_time_slots')
        .update({
          label: slotForm.label,
          start_time: slotForm.startTime,
          end_time: slotForm.endTime,
          sort_order: parseInt(slotForm.sortOrder) || 0,
        })
        .eq('id', editingSlot.id);
      if (error) {
        toast.error('수정 실패: ' + error.message);
        setSavingSlot(false);
        return;
      }
      await auditLog({
        action: 'update_bbq_time_slot',
        resource_type: 'bbq_time_slot',
        resource_id: editingSlot.id,
        metadata: {
          label: slotForm.label,
          start_time: slotForm.startTime,
          end_time: slotForm.endTime,
        },
      });
      toast.success('타임 슬롯이 수정되었습니다.');
    } else {
      const { data, error } = await supabase
        .from('bbq_time_slots')
        .insert({
          slot_number: nextSlotNumber,
          label: slotForm.label,
          start_time: slotForm.startTime,
          end_time: slotForm.endTime,
          sort_order: parseInt(slotForm.sortOrder) || nextSlotNumber,
        })
        .select()
        .single();
      if (error) {
        toast.error('추가 실패: ' + error.message);
        setSavingSlot(false);
        return;
      }
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
    const activeSlotCount = timeSlots.filter((s) => s.is_active).length;
    if (slot.is_active && activeSlotCount <= 1) {
      toast.error('최소 1개의 활성 타임 슬롯이 필요합니다.');
      return;
    }
    await supabase
      .from('bbq_time_slots')
      .update({ is_active: !slot.is_active })
      .eq('id', slot.id);
    await auditLog({
      action: slot.is_active ? 'deactivate_bbq_time_slot' : 'activate_bbq_time_slot',
      resource_type: 'bbq_time_slot',
      resource_id: slot.id,
      metadata: {
        slot_number: slot.slot_number,
        label: slot.label,
        is_active: !slot.is_active,
      },
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

  return (
    <section className="bg-card border rounded-xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">타임 슬롯</h3>
        <button
          onClick={openNewSlot}
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
        >
          <Plus className="size-3.5" /> 타임 추가
        </button>
      </div>

      {showSlotForm && (
        <div className="bg-muted/30 rounded-lg p-4 mb-1 space-y-3">
          <h4 className="text-xs font-semibold text-text-secondary">
            {editingSlot ? '타임 수정' : '새 타임 추가'}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">라벨 *</label>
              <input
                type="text"
                value={slotForm.label}
                onChange={(e) => setSlotForm({ ...slotForm, label: e.target.value })}
                placeholder="예: 4타임"
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">시작 시간 *</label>
              <input
                type="time"
                value={slotForm.startTime}
                onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">종료 시간 *</label>
              <input
                type="time"
                value={slotForm.endTime}
                onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">정렬 순서</label>
              <input
                type="number"
                value={slotForm.sortOrder}
                onChange={(e) => setSlotForm({ ...slotForm, sortOrder: e.target.value })}
                className={inputCls + ' w-full'}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSlot}
              disabled={savingSlot}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {savingSlot ? '저장 중...' : editingSlot ? '수정' : '추가'}
            </button>
            <button
              onClick={() => setShowSlotForm(false)}
              className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {timeSlots.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">{slot.label}</span>
              <span className="text-xs text-text-secondary">
                {slot.start_time.slice(0, 5)} ~ {slot.end_time.slice(0, 5)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full mr-1 ${
                  slot.is_active ? 'text-green bg-green-light' : 'text-gray bg-gray-light'
                }`}
              >
                {slot.is_active ? '활성' : '비활성'}
              </span>
              <button
                onClick={() => toggleSlotActive(slot)}
                className="p-1.5 hover:bg-accent rounded-md"
                aria-label={slot.is_active ? '비활성화' : '활성화'}
              >
                {slot.is_active ? (
                  <ToggleRight className="size-4 text-green" />
                ) : (
                  <ToggleLeft className="size-4 text-gray" />
                )}
              </button>
              <button
                onClick={() => openEditSlot(slot)}
                className="p-1.5 hover:bg-accent rounded-md"
                aria-label="수정"
              >
                <Edit3 className="size-3.5 text-text-secondary" />
              </button>
              <button
                onClick={() => handleDeleteSlot(slot)}
                className="p-1.5 hover:bg-accent rounded-md"
                aria-label="삭제"
              >
                <Trash2 className="size-3.5 text-red" />
              </button>
            </div>
          </div>
        ))}
        {timeSlots.length === 0 && (
          <p className="text-sm text-text-tertiary py-4 text-center">
            등록된 타임 슬롯이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
