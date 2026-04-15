'use client';

import { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MEMBER_STATUS } from '@/lib/member-constants';
import MembershipCard from '@/components/members/MembershipCard';
import toast from 'react-hot-toast';
import type { Member, MemberStatus } from '@/types';
import type { useMemberDetail } from '@/lib/use-member-detail';

interface Props {
  data: ReturnType<typeof useMemberDetail>;
}

export default function MemberSidebar({ data }: Props) {
  const { member, membership, statusLogs, refetch } = data;
  const supabase = createClient();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!member) return null;

  const status = MEMBER_STATUS[member.status];

  const startEdit = (field: string, value: string) => {
    setEditField(field);
    setEditValue(value || '');
  };

  const saveEdit = async () => {
    if (!editField) return;
    const { error } = await supabase.from('members').update({ [editField]: editValue.trim() || null }).eq('id', member.id);
    if (error) toast.error('수정 실패');
    else { toast.success('수정되었습니다.'); refetch(); }
    setEditField(null);
  };

  const InfoRow = ({ label, field, value }: { label: string; field?: string; value: string }) => (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-xs text-text-tertiary shrink-0 w-16">{label}</span>
      {editField === field ? (
        <div className="flex items-center gap-1">
          <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
            className="text-xs border border-primary rounded px-1.5 py-0.5 w-32 focus:outline-none" />
          <button onClick={saveEdit} className="p-0.5 text-green hover:bg-green/10 rounded"><Check className="size-3" /></button>
          <button onClick={() => setEditField(null)} className="p-0.5 text-red hover:bg-red/10 rounded"><X className="size-3" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs text-text-primary truncate">{value || '-'}</span>
          {field && (
            <button onClick={() => startEdit(field, value)} className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent rounded">
              <Edit3 className="size-2.5 text-text-tertiary" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 프로필 카드 */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">{member.name[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{member.name}</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ color: status.color, backgroundColor: status.bg }}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="space-y-0 group">
          <InfoRow label="연락처" field="phone" value={member.phone} />
          <InfoRow label="이메일" field="email" value={member.email} />
          <InfoRow label="주소" field="address" value={member.address} />
          <InfoRow label="차량번호" field="car_number" value={member.car_number || ''} />
          <InfoRow label="가족 수" value={member.family_size ? `${member.family_size}명` : '-'} />
          <InfoRow label="영농경험" value={member.farming_experience ? '있음' : '없음'} />
          <InfoRow label="관심작물" value={member.interested_crops?.join(', ') || '-'} />
        </div>

        {member.memo && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] text-text-tertiary mb-1">메모</p>
            <p className="text-xs text-text-secondary">{member.memo}</p>
          </div>
        )}
      </div>

      {/* 회원권 */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs font-semibold text-text-secondary mb-3">회원권</p>
        {membership ? (
          <MembershipCard membership={membership} compact={false} />
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-text-tertiary">활성 회원권이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 상태 이력 */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs font-semibold text-text-secondary mb-3">상태 이력</p>
        {statusLogs.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-2">변경 이력이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {statusLogs.slice(0, 5).map(log => {
              const from = MEMBER_STATUS[log.from_status as MemberStatus];
              const to = MEMBER_STATUS[log.to_status as MemberStatus];
              return (
                <div key={log.id} className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: to?.color || '#6B7280' }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-primary">
                      <span style={{ color: from?.color }}>{from?.label}</span>
                      {' → '}
                      <span className="font-medium" style={{ color: to?.color }}>{to?.label}</span>
                    </p>
                    {log.reason && <p className="text-[10px] text-text-tertiary truncate">{log.reason}</p>}
                    <p className="text-[10px] text-text-tertiary">{new Date(log.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border text-[10px] text-text-tertiary space-y-0.5">
          <p>가입일: {new Date(member.created_at).toLocaleDateString('ko-KR')}</p>
          {member.approved_at && <p>승인일: {new Date(member.approved_at).toLocaleDateString('ko-KR')}</p>}
        </div>
      </div>
    </div>
  );
}
