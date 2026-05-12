'use server';

/**
 * 070 회원 self-service 탈퇴 Server Action
 * - IP / User-Agent 수집 (audit_logs 메타데이터로)
 * - self_request_member_deletion RPC 호출
 * - 알림톡 자동 발송 (D-30 안내, PIPA 정합)
 */

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { sendAlimtalk } from '@/lib/aligo';

interface MemberRow {
  id: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
}

export async function requestSelfWithdrawal(reasonCategory: string, reasonMemo: string | null) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim()
    || h.get('x-real-ip')
    || null;
  const ua = h.get('user-agent') || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('self_request_member_deletion', {
    p_reason_category: reasonCategory,
    p_reason_memo: reasonMemo,
  });

  if (error) return { error: error.message };

  const member = data as MemberRow | null;

  // audit_logs 에 IP/UA 별도 기록
  if (member) {
    await supabase.from('audit_logs').insert({
      actor_id: member.user_id ?? null,
      action: 'self_withdrawal_metadata',
      resource_type: 'member',
      resource_id: member.id,
      metadata: { ip, user_agent: ua, recorded_at: new Date().toISOString() },
    });

    // 알림톡 발송 (D-30 안내) — 비차단 (실패해도 탈퇴 진행)
    if (member.phone) {
      try {
        const purgeDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('ko-KR');
        const message =
          `${member.name ?? '회원'}님 탈퇴 신청이 접수되었습니다.\n` +
          `30일 후(${purgeDate}) 개인정보가 자동 파기됩니다.\n` +
          `취소를 원하시면 마이페이지에서 [복원]을 클릭하세요.`;
        await sendAlimtalk(member.phone, 'withdrawal', message);

        // 알림 로그 기록
        await supabase.from('audit_logs').insert({
          actor_id: member.user_id ?? null,
          action: 'self_withdrawal_alimtalk_sent',
          resource_type: 'member',
          resource_id: member.id,
          metadata: { phone_masked: member.phone.slice(0, 3) + '****' + member.phone.slice(-4) },
        });
      } catch (e) {
        await supabase.from('audit_logs').insert({
          actor_id: member.user_id ?? null,
          action: 'self_withdrawal_alimtalk_failed',
          resource_type: 'member',
          resource_id: member.id,
          metadata: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
  }

  return { ok: true };
}

export async function recordPipaConsent(memberId: string) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim()
    || h.get('x-real-ip')
    || null;
  const ua = h.get('user-agent') || null;

  const supabase = await createClient();
  const { error } = await supabase.from('members')
    .update({
      pipa_agreed_at: new Date().toISOString(),
      pipa_agreed_ip: ip,
      pipa_agreed_ua: ua,
    })
    .eq('id', memberId);

  if (error) return { error: error.message };
  return { ok: true };
}
