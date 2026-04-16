'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { RENTAL_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import MembershipCard from '@/components/memberships/MembershipCard';
import type { FarmRental } from '@/types';

type RentalDetail = FarmRental & {
  farm: { number: number; name: string; area_pyeong: number; zone?: { name: string } };
  customer: { name: string; phone: string };
};

export default function RentalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const id = params.id as string;

  const [rental, setRental] = useState<RentalDetail | null>(null);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<{ id: string; content: string; note_type: string; created_at: string; author?: { name: string } }[]>([]);

  const fetchData = async () => {
    const { data } = await supabase
      .from('farm_rentals')
      .select('*, farm:farms(number, name, area_pyeong, zone:farm_zones(name)), customer:customers(name, phone)')
      .eq('id', id)
      .single();
    if (data) setRental(data as RentalDetail);

    const { data: notesData } = await supabase
      .from('inquiry_notes')
      .select('*, author:profiles(name)')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: false });
    if (notesData) setNotes(notesData);
  };

  useEffect(() => {
    fetchData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (newStatus: string) => {
    await supabase.from('farm_rentals').update({ status: newStatus }).eq('id', id);
    toast.success('계약 상태가 변경되었습니다');
    fetchData();
  };

  const handlePaymentStatusChange = async (status: string) => {
    await supabase.from('farm_rentals').update({ payment_status: status }).eq('id', id);
    toast.success('결제 상태가 변경되었습니다');
    fetchData();
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: id,
      author_id: user?.id,
      content: newNote.trim(),
      note_type: 'memo',
    });
    setNewNote('');
    toast.success('메모가 저장되었습니다');
    fetchData();
  };

  if (!rental) {
    return <div className="text-center py-20 text-text-tertiary">불러오는 중...</div>;
  }

  const daysLeft = differenceInDays(new Date(rental.end_date), new Date());
  const statusMeta = RENTAL_STATUS[rental.status] || RENTAL_STATUS.active;

  return (
    <div className="max-w-4xl space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors duration-150 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        목록으로
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[20px] font-bold text-primary tracking-tight">{rental.farm?.zone?.name} {rental.farm?.number}번</span>
          <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
          {rental.status === 'active' && (
            <Badge
              label={daysLeft <= 0 ? '만료됨' : `D-${daysLeft}`}
              color={daysLeft <= 7 ? '#DC2626' : daysLeft <= 30 ? '#D97706' : '#059669'}
              bg={daysLeft <= 7 ? '#FEF2F2' : daysLeft <= 30 ? '#FFFBEB' : '#ECFDF5'}
            />
          )}
        </div>
        <h1 className="text-[20px] font-bold text-text-primary tracking-tight">{rental.customer?.name}</h1>
        <p className="text-[14px] text-text-secondary mt-0.5">{rental.customer?.phone}</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contract info */}
        <Card>
          <h2 className="text-[14px] font-semibold text-text-primary mb-4">계약 정보</h2>
          <div className="bg-bg-muted rounded-xl p-4 space-y-0">
            {[
              ['농장', `${rental.farm?.name} (${rental.farm?.area_pyeong}평)`],
              ['플랜', rental.plan || '-'],
              ['기간', `${format(new Date(rental.start_date), 'yyyy.M.d', { locale: ko })} ~ ${format(new Date(rental.end_date), 'yyyy.M.d', { locale: ko })}`],
              ['결제 수단', rental.payment_method],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-[14px] py-2.5 border-b border-border-light last:border-b-0">
                <span className="text-text-secondary">{label}</span>
                <span className="text-text-primary font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[14px] py-2.5">
              <span className="text-text-secondary">월 결제액</span>
              <span className="text-primary font-bold">{rental.monthly_fee.toLocaleString()}원</span>
            </div>
          </div>
          {rental.notes && (
            <div className="mt-3 bg-bg-muted rounded-xl p-4">
              <span className="text-[12px] text-text-tertiary font-medium">메모</span>
              <p className="text-[14px] text-text-primary mt-1">{rental.notes}</p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <Card>
          <h2 className="text-[14px] font-semibold text-text-primary mb-4">관리</h2>
          <div className="space-y-4">
            <Select
              label="계약 상태"
              options={[
                { value: 'active', label: '임대중' },
                { value: 'expired', label: '만료' },
                { value: 'cancelled', label: '취소' },
              ]}
              value={rental.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full"
            />
            <Select
              label="결제 상태"
              options={[
                { value: '대기', label: '대기' },
                { value: '납부완료', label: '납부완료' },
                { value: '미납', label: '미납' },
              ]}
              value={rental.payment_status}
              onChange={(e) => handlePaymentStatusChange(e.target.value)}
              className="w-full"
            />
          </div>
        </Card>

        {/* Membership */}
        <MembershipCard
          memberId={rental.member_id}
          rentalId={rental.id}
          farmId={rental.farm_id}
          paymentStatus={rental.payment_status}
          onChanged={fetchData}
        />
      </div>

      {/* Notes */}
      <Card>
        <h2 className="text-[14px] font-semibold text-text-primary mb-3">메모</h2>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          placeholder="메모를 입력하세요..."
          className="w-full bg-bg-input border border-border rounded-xl px-3.5 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150 resize-none mb-3"
        />
        <Button onClick={handleAddNote} variant="primary" size="sm" disabled={!newNote.trim()}>
          메모 저장
        </Button>

        {notes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue mt-1.5 shrink-0 ring-2 ring-white" />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">{n.author?.name || '시스템'}</span>
                    <span className="text-[11px] text-text-tertiary">
                      {format(new Date(n.created_at), 'M월 d일 HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <p className="text-[13px] text-text-secondary mt-0.5">{n.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
