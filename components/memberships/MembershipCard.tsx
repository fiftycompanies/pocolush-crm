'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CreditCard, Pause, Play, CalendarCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SuspendDialog from './SuspendDialog';
import PeriodEditDialog from './PeriodEditDialog';
import type { Membership } from '@/types';

interface Props {
  memberId?: string | null;
  rentalId?: string;
  farmId?: string | null;
  paymentStatus?: string;
  onChanged?: () => void;
}

export default function MembershipCard({ memberId, rentalId, farmId, paymentStatus, onChanged }: Props) {
  const supabase = createClient();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const fetchMembership = async () => {
    setLoading(true);
    let query = supabase.from('memberships').select('*').order('created_at', { ascending: false });
    if (memberId && farmId) {
      query = query.eq('member_id', memberId).eq('farm_id', farmId);
    } else if (memberId) {
      query = query.eq('member_id', memberId);
    } else {
      setMembership(null);
      setLoading(false);
      return;
    }
    const { data } = await query.limit(1);
    setMembership((data && data[0]) || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, farmId]);

  const handleResume = async () => {
    if (!membership) return;
    const { error } = await supabase.rpc('resume_membership', { p_membership_id: membership.id });
    if (error) {
      if (error.message === 'MEMBERSHIP_EXPIRED') {
        toast.error('만료된 회원권은 재개할 수 없습니다');
      } else {
        toast.error('재개 실패: ' + error.message);
      }
    } else {
      toast.success('회원권이 재개되었습니다');
      fetchMembership();
      onChanged?.();
    }
  };

  const handleManualIssue = async () => {
    if (!rentalId) return;
    setIssuing(true);
    const { error } = await supabase.rpc('issue_membership', { p_rental_id: rentalId });
    if (error) {
      const msg =
        error.message === 'MEMBER_NOT_LINKED' ? '회원이 연결되지 않았습니다' :
        error.message === 'ALREADY_ISSUED' ? '이미 발급된 회원권이 있습니다' :
        error.message === 'FORBIDDEN' ? '권한이 없습니다' :
        '발급 실패: ' + error.message;
      toast.error(msg);
    } else {
      toast.success('회원권이 발급되었습니다');
      fetchMembership();
      onChanged?.();
    }
    setIssuing(false);
  };

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-5">
        <h2 className="text-[14px] font-semibold text-text-primary mb-2">회원권</h2>
        <p className="text-[13px] text-text-tertiary">불러오는 중...</p>
      </div>
    );
  }

  // 미발급 상태
  if (!membership) {
    const canManualIssue = !!memberId && paymentStatus === '납부완료';
    return (
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-text-tertiary" />
          <h2 className="text-[14px] font-semibold text-text-primary">회원권</h2>
        </div>
        <div className="bg-bg-muted rounded-xl p-4 mb-3">
          <p className="text-[13px] text-text-secondary mb-1">미발급</p>
          <p className="text-[12px] text-text-tertiary">
            {!memberId
              ? '회원 연결이 필요합니다 (customers.phone ↔ members.phone)'
              : paymentStatus !== '납부완료'
                ? '결제 완료(납부완료) 시 자동 발급됩니다'
                : '자동 발급 실패 — 수동 발급을 눌러주세요'}
          </p>
        </div>
        {rentalId && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleManualIssue}
            disabled={!canManualIssue || issuing}
            loading={issuing}
            className="w-full"
          >
            수동 발급
          </Button>
        )}
      </div>
    );
  }

  const statusMeta =
    membership.status === 'active'
      ? { label: '활성', color: '#059669', bg: '#ECFDF5' }
      : membership.status === 'cancelled'
        ? { label: '정지', color: '#DC2626', bg: '#FEF2F2' }
        : { label: '만료', color: '#6B7280', bg: '#F3F4F6' };

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <h2 className="text-[14px] font-semibold text-text-primary">회원권</h2>
        </div>
        <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
      </div>

      <div className="bg-bg-muted rounded-xl p-4 space-y-2.5">
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">코드</span>
          <span className="font-mono text-text-primary font-medium">{membership.membership_code}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">기간</span>
          <span className="text-text-primary font-medium">
            {format(new Date(membership.start_date), 'yy.M.d', { locale: ko })} ~{' '}
            {format(new Date(membership.end_date), 'yy.M.d', { locale: ko })}
          </span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">구좌</span>
          <span className="text-text-primary font-medium">{membership.plots}구좌</span>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => setPeriodOpen(true)} className="flex-1">
          <CalendarCog className="w-3.5 h-3.5" />
          기간 수정
        </Button>
        {membership.status === 'active' ? (
          <Button variant="danger" size="sm" onClick={() => setSuspendOpen(true)} className="flex-1">
            <Pause className="w-3.5 h-3.5" />
            정지
          </Button>
        ) : membership.status === 'cancelled' ? (
          <Button variant="primary" size="sm" onClick={handleResume} className="flex-1">
            <Play className="w-3.5 h-3.5" />
            재개
          </Button>
        ) : null}
      </div>

      <SuspendDialog
        open={suspendOpen}
        membershipId={membership.id}
        onClose={() => setSuspendOpen(false)}
        onSuccess={() => {
          setSuspendOpen(false);
          fetchMembership();
          onChanged?.();
        }}
      />

      <PeriodEditDialog
        open={periodOpen}
        membership={membership}
        onClose={() => setPeriodOpen(false)}
        onSuccess={() => {
          setPeriodOpen(false);
          fetchMembership();
          onChanged?.();
        }}
      />
    </div>
  );
}
