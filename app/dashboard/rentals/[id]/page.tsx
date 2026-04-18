'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { RENTAL_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import MembershipCard from '@/components/memberships/MembershipCard';
import { auditLog } from '@/lib/audit-log';
import type { FarmRental } from '@/types';

interface LinkedMembership {
  id: string;
  membership_code: string;
}

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

  // 결제 역방향 모달 상태
  const [paymentModal, setPaymentModal] = useState<{
    newStatus: string;
    linkedMembership: LinkedMembership | null;
  } | null>(null);
  const [cancelMembershipChecked, setCancelMembershipChecked] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState(false);

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

  // R5: farm_id 할당 (나중에 할당 경로)
  const [availableFarms, setAvailableFarms] = useState<{ id: string; number: number; name: string; area_pyeong: number }[]>([]);
  useEffect(() => {
    if (rental && !rental.farm_id) {
      supabase.from('farms')
        .select('id, number, name, area_pyeong')
        .in('status', ['available', 'maintenance'])
        .order('number')
        .then(({ data }) => setAvailableFarms((data as typeof availableFarms) || []));
    }
  }, [rental, supabase]);

  const handleAssignFarm = async (farmId: string) => {
    if (!farmId) return;
    const { error } = await supabase.from('farm_rentals').update({ farm_id: farmId }).eq('id', id);
    if (error) { toast.error('농장 할당 실패: ' + error.message); return; }
    toast.success('농장이 할당되었습니다. (납부완료면 회원권이 자동 발급됩니다)');
    fetchData();
  };

  const handlePaymentStatusChange = async (status: string) => {
    if (!rental) return;
    const oldStatus = rental.payment_status;

    // 역방향(납부완료 → 타상태) 전환 시 연결된 활성 회원권 조회
    if (oldStatus === '납부완료' && status !== '납부완료' && rental.member_id) {
      const { data: ms } = await supabase
        .from('memberships')
        .select('id, membership_code')
        .eq('farm_id', rental.farm_id)
        .eq('member_id', rental.member_id)
        .eq('status', 'active')
        .maybeSingle();

      // 활성 회원권 있든 없든 변경 자체는 확인 모달 경유
      setPaymentModal({ newStatus: status, linkedMembership: ms as LinkedMembership | null });
      setCancelMembershipChecked(true); // 기본값: 함께 정지
      return;
    }

    // 정방향 또는 회원권 연결 없음 — 즉시 변경
    await supabase.from('farm_rentals').update({ payment_status: status }).eq('id', id);
    toast.success('결제 상태가 변경되었습니다');
    fetchData();
  };

  const confirmPaymentChange = async () => {
    if (!paymentModal || !rental) return;
    setPaymentBusy(true);
    const { newStatus, linkedMembership } = paymentModal;
    const oldStatus = rental.payment_status;

    try {
      // 회원권 정지 (선택 시)
      if (linkedMembership && cancelMembershipChecked) {
        const { error: sErr } = await supabase.rpc('suspend_membership', {
          p_membership_id: linkedMembership.id,
          p_reason: `결제 ${oldStatus}→${newStatus} 연동 정지`,
        });
        if (sErr) {
          toast.error('회원권 정지 실패: ' + sErr.message);
          setPaymentBusy(false);
          return;
        }
        await auditLog({
          action: 'cancel_membership_via_payment',
          resource_type: 'membership',
          resource_id: linkedMembership.id,
          metadata: {
            rental_id: id,
            old_payment_status: oldStatus,
            new_payment_status: newStatus,
            membership_code: linkedMembership.membership_code,
          },
        });
      }

      const { error } = await supabase
        .from('farm_rentals')
        .update({ payment_status: newStatus })
        .eq('id', id);
      if (error) {
        toast.error('결제 상태 변경 실패: ' + error.message);
        setPaymentBusy(false);
        return;
      }
      toast.success(
        linkedMembership && cancelMembershipChecked
          ? '결제 상태 변경 + 회원권 정지 완료'
          : '결제 상태가 변경되었습니다'
      );
      setPaymentModal(null);
      fetchData();
    } finally {
      setPaymentBusy(false);
    }
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
          {rental.farm ? (
            <span className="text-[20px] font-bold text-primary tracking-tight">{rental.farm?.zone?.name} {rental.farm?.number}번</span>
          ) : (
            <span className="text-[20px] font-bold text-amber-700 tracking-tight">농장 미할당</span>
          )}
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

        {/* R5: 농장 미할당 시 할당 드롭다운 */}
        {!rental.farm_id && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[12px] text-amber-800 mb-2">
              📌 이 계약에는 농장이 할당되지 않았습니다. 아래에서 농장을 선택하면 회원권이 자동 발급됩니다.
            </p>
            <select
              onChange={(e) => handleAssignFarm(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg text-sm"
              defaultValue=""
            >
              <option value="" disabled>농장을 선택하세요</option>
              {availableFarms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.number}번 — {f.name} ({f.area_pyeong}평)
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contract info */}
        <Card>
          <h2 className="text-[14px] font-semibold text-text-primary mb-4">계약 정보</h2>
          <div className="bg-bg-muted rounded-xl p-4 space-y-0">
            {[
              ['농장', rental.farm ? `${rental.farm.name} (${rental.farm.area_pyeong}평)` : '미할당'],
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

      {/* 결제 역방향 전환 확인 모달 */}
      {paymentModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => !paymentBusy && setPaymentModal(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">결제 상태 변경 확인</h2>
              <button
                onClick={() => !paymentBusy && setPaymentModal(null)}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <p>
                결제 상태를 <b>"{rental.payment_status}"</b> → <b>"{paymentModal.newStatus}"</b> 로
                변경합니다.
              </p>

              {paymentModal.linkedMembership ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                  <p className="text-amber-800">
                    연결된 활성 회원권이 있습니다:{' '}
                    <span className="font-mono font-semibold">
                      {paymentModal.linkedMembership.membership_code}
                    </span>
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cancelMembershipChecked}
                      onChange={(e) => setCancelMembershipChecked(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-text-primary">
                      이 회원권도 함께 <b>정지</b>합니다
                      <span className="block text-text-tertiary mt-0.5">
                        해제 시 결제만 변경되고 회원권은 활성 유지됩니다.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">
                  해당 계약에 연결된 활성 회원권이 없습니다. 결제 상태만 변경됩니다.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => setPaymentModal(null)}
                disabled={paymentBusy}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={confirmPaymentChange}
                disabled={paymentBusy}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
              >
                {paymentBusy ? '처리 중...' : '변경 실행'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
