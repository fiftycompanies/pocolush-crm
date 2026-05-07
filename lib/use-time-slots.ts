'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BBQTimeSlot } from '@/types';

export function useTimeSlots(activeOnly = false) {
  const supabase = createClient();
  const [timeSlots, setTimeSlots] = useState<BBQTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    let q = supabase.from('bbq_time_slots').select('*').order('sort_order');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    setTimeSlots((data as BBQTimeSlot[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  useEffect(() => { refetch(); }, [refetch]);

  // TIME_SLOTS 호환 맵 (slotNumber → { label, time })
  const slotMap = useMemo(() => {
    const map: Record<number, { label: string; time: string }> = {};
    timeSlots.forEach(s => {
      map[s.slot_number] = {
        label: s.label,
        time: `${s.start_time.slice(0, 5)} ~ ${s.end_time.slice(0, 5)}`,
      };
    });
    return map;
  }, [timeSlots]);

  // 로딩 중 폴백 헬퍼
  function getSlotLabel(slotNumber: number): string {
    return slotMap[slotNumber]?.label ?? `${slotNumber}타임`;
  }
  function getSlotTime(slotNumber: number): string {
    return slotMap[slotNumber]?.time ?? '';
  }

  return { timeSlots, slotMap, loading, refetch, getSlotLabel, getSlotTime };
}
