'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { RESERVATION_STATUS, TIME_SLOTS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { BBQReservation, Member } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

type ReservationWithMember = BBQReservation & { member?: Pick<Member, 'name' | 'phone'> };

const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'confirmed', label: '예약확정' },
  { key: 'completed', label: '이용완료' },
  { key: 'cancelled', label: '취소' },
  { key: 'no_show', label: '노쇼' },
] as const;

export default function BBQAdminPage() {
  const supabase = createClient();
  const [reservations, setReservations] = useState<ReservationWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateOffset, setDateOffset] = useState(0);

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + dateOffset);
  const dateStr = currentDate.toISOString().split('T')[0];

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('bbq_reservations')
      .select('*, member:members(name, phone)')
      .eq('reservation_date', dateStr)
      .order('time_slot')
      .order('bbq_number');

    if (tab !== 'all') query = query.eq('status', tab);
    const { data } = await query;
    setReservations(data || []);
    setLoading(false);
  }, [supabase, dateStr, tab]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const filtered = reservations.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.member?.name?.toLowerCase().includes(q) || r.member?.phone?.includes(q);
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('bbq_reservations').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('상태 변경 실패');
    else { toast.success('상태가 변경되었습니다.'); fetchReservations(); }
  };

  const todayCount = reservations.filter(r => r.status === 'confirmed').length;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">바베큐 예약 관리</h1>
          <p className="text-sm text-text-secondary mt-1">예약 현황을 확인하고 관리하세요.</p>
        </div>
        <ExportButton target="bbq" params={{ date: dateStr, status: tab === 'all' ? '' : tab, search }} />
      </div>

      {/* 날짜 네비게이터 */}
      <div className="flex items-center justify-between bg-card border rounded-xl px-4 py-3">
        <button onClick={() => setDateOffset(d => d - 1)} className="p-1 hover:bg-accent rounded-md"><ChevronLeft className="size-4" /></button>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">{dateStr.replace(/-/g, '.')}</p>
          <p className="text-[11px] text-text-tertiary">
            {dateOffset === 0 ? '오늘' : dateOffset === 1 ? '내일' : dateOffset === -1 ? '어제' : ''}
            {todayCount > 0 && ` · 예약 ${todayCount}건`}
          </p>
        </div>
        <button onClick={() => setDateOffset(d => d + 1)} className="p-1 hover:bg-accent rounded-md"><ChevronRight className="size-4" /></button>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 border-b border-border flex-1">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
              {t.label}
              {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 / 연락처"
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center">
          <p className="text-sm text-text-tertiary">해당 날짜에 예약이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-text-secondary">타임</th>
                <th className="px-4 py-3 font-medium text-text-secondary">장소</th>
                <th className="px-4 py-3 font-medium text-text-secondary">예약자</th>
                <th className="px-4 py-3 font-medium text-text-secondary">연락처</th>
                <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const status = RESERVATION_STATUS[r.status];
                const slot = TIME_SLOTS[r.time_slot];
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-3 text-text-primary font-medium">{slot?.label} <span className="text-text-tertiary text-xs">{slot?.time}</span></td>
                    <td className="px-4 py-3">{r.bbq_number}번</td>
                    <td className="px-4 py-3 font-medium">{r.member?.name || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.member?.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'confirmed' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleStatusChange(r.id, 'completed')} className="px-2 py-1 text-[11px] rounded-md bg-blue-light text-blue hover:bg-blue/10">완료</button>
                          <button onClick={() => handleStatusChange(r.id, 'no_show')} className="px-2 py-1 text-[11px] rounded-md bg-red-light text-red hover:bg-red/10">노쇼</button>
                          <button onClick={() => handleStatusChange(r.id, 'cancelled')} className="px-2 py-1 text-[11px] rounded-md bg-gray-light text-gray hover:bg-gray/10">취소</button>
                        </div>
                      )}
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
