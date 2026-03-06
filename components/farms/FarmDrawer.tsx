'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import Drawer from '@/components/ui/Drawer';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FARM_STATUS, PAYMENT_STATUS, EXPIRY_DANGER_DAYS, EXPIRY_WARNING_DAYS } from '@/lib/constants';
import type { Farm, FarmRental } from '@/types';

interface FarmDrawerProps {
  farm: Farm | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function FarmDrawer({ farm, isOpen, onClose, onUpdate }: FarmDrawerProps) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [history, setHistory] = useState<(FarmRental & { customer?: { name: string; phone: string } })[]>([]);

  useEffect(() => {
    if (!farm || !isOpen) return;
    setEditName(farm.name);
    setEditArea(String(farm.area_pyeong));

    const fetchHistory = async () => {
      const { data } = await supabase
        .from('farm_rentals')
        .select('*, customer:customers(name, phone)')
        .eq('farm_id', farm.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setHistory(data);
    };
    fetchHistory();
  }, [farm, isOpen, supabase]);

  const handleSaveEdit = async () => {
    if (!farm) return;
    await supabase
      .from('farms')
      .update({ name: editName, area_pyeong: parseFloat(editArea) })
      .eq('id', farm.id);
    toast.success('농장 정보가 수정되었습니다');
    setEditing(false);
    onUpdate?.();
  };

  const handleStatusChange = async (status: string) => {
    if (!farm) return;
    await supabase.from('farms').update({ status }).eq('id', farm.id);
    toast.success('상태가 변경되었습니다');
    onUpdate?.();
  };

  if (!farm) return null;

  const rental = farm.current_rental;
  const daysLeft = rental ? differenceInDays(new Date(rental.end_date), new Date()) : null;
  const statusMeta = FARM_STATUS[farm.status] || FARM_STATUS.available;

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[20px] font-bold text-text-primary">{farm.number}번 농장</span>
            <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors">
            ✕
          </button>
        </div>

        {/* Farm info */}
        <div className="space-y-3">
          {editing ? (
            <div className="space-y-3">
              <Input label="농장명" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input label="면적 (평)" type="number" step="0.1" value={editArea} onChange={(e) => setEditArea(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} variant="primary" size="sm">저장</Button>
                <Button onClick={() => setEditing(false)} variant="ghost" size="sm">취소</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[14px] py-2 border-b border-[#F3F4F6]">
                <span className="text-text-secondary">농장명</span>
                <span className="text-text-primary">{farm.name}</span>
              </div>
              <div className="flex justify-between text-[14px] py-2 border-b border-[#F3F4F6]">
                <span className="text-text-secondary">면적</span>
                <span className="text-text-primary">{farm.area_pyeong}평 ({farm.area_sqm}m²)</span>
              </div>
              <Select
                label="상태"
                options={[
                  { value: 'available', label: '비어있음' },
                  { value: 'rented', label: '임대중' },
                  { value: 'maintenance', label: '관리중' },
                ]}
                value={farm.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full"
              />
              <Button onClick={() => setEditing(true)} variant="secondary" size="sm" className="w-full mt-2">
                정보 수정
              </Button>
            </>
          )}
        </div>

        {/* Current rental */}
        {rental && (
          <div className="bg-bg-page rounded-xl p-4 border border-border space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-semibold text-text-primary">현재 임대 계약</h3>
              {daysLeft !== null && (
                <Badge
                  label={daysLeft <= 0 ? '만료됨' : `D-${daysLeft}`}
                  color={daysLeft <= EXPIRY_DANGER_DAYS ? '#DC2626' : daysLeft <= EXPIRY_WARNING_DAYS ? '#D97706' : '#059669'}
                  bg={daysLeft <= EXPIRY_DANGER_DAYS ? '#FEF2F2' : daysLeft <= EXPIRY_WARNING_DAYS ? '#FFFBEB' : '#ECFDF5'}
                />
              )}
            </div>
            <div className="space-y-2">
              {[
                ['고객', rental.customer?.name],
                ['연락처', rental.customer?.phone],
                ['플랜', rental.plan || '-'],
                ['기간', `${format(new Date(rental.start_date), 'yy.M.d')} ~ ${format(new Date(rental.end_date), 'yy.M.d')}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-[14px]">
                  <span className="text-text-secondary">{label}</span>
                  <span className="text-text-primary">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-[14px]">
                <span className="text-text-secondary">월 결제액</span>
                <span className="text-primary font-semibold">{rental.monthly_fee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-[14px] items-center">
                <span className="text-text-secondary">결제</span>
                <Badge
                  label={`${rental.payment_method} · ${rental.payment_status}`}
                  color={PAYMENT_STATUS[rental.payment_status]?.color || '#6B7280'}
                  bg={PAYMENT_STATUS[rental.payment_status]?.bg}
                />
              </div>
            </div>
            <Button
              onClick={() => router.push(`/dashboard/rentals/${rental.id}`)}
              variant="secondary"
              size="sm"
              className="w-full mt-2"
            >
              계약 상세 보기
            </Button>
          </div>
        )}

        {/* History */}
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">임대 이력</h3>
          {history.length === 0 ? (
            <p className="text-text-tertiary text-[14px] text-center py-4">임대 이력이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {history.map((r) => {
                const rStatusColor = r.status === 'active' ? '#059669' : r.status === 'expired' ? '#DC2626' : '#6B7280';
                const rStatusBg = r.status === 'active' ? '#ECFDF5' : r.status === 'expired' ? '#FEF2F2' : '#F3F4F6';
                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/dashboard/rentals/${r.id}`)}
                    className="bg-bg-page border border-border rounded-xl p-3 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-text-primary font-medium">{r.customer?.name}</span>
                      <Badge
                        label={r.status === 'active' ? '임대중' : r.status === 'expired' ? '만료' : '취소'}
                        color={rStatusColor}
                        bg={rStatusBg}
                      />
                    </div>
                    <p className="text-[12px] text-text-tertiary mt-1">
                      {format(new Date(r.start_date), 'yy.M.d')} ~ {format(new Date(r.end_date), 'yy.M.d')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New rental button */}
        <Button
          onClick={() => {
            onClose();
            router.push(`/dashboard/rentals/new?farmId=${farm.id}`);
          }}
          variant="primary"
          className="w-full"
        >
          새 임대 계약 등록
        </Button>
      </div>
    </Drawer>
  );
}
