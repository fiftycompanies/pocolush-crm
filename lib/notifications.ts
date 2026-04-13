import { createClient } from '@/lib/supabase/client';
import { sendAlimtalk } from '@/lib/aligo';
import { sendPush } from '@/lib/fcm';
import type { NotificationType } from '@/types';

interface SendNotificationParams {
  memberId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}

export async function sendNotification(params: SendNotificationParams) {
  const supabase = createClient();

  // 1. 항상: member_notifications INSERT (인앱 알림)
  const { data: notification, error: notifError } = await supabase
    .from('member_notifications')
    .insert({
      member_id: params.memberId,
      type: params.type,
      title: params.title,
      message: params.message,
      reference_id: params.referenceId || null,
      reference_type: params.referenceType || null,
    })
    .select()
    .single();

  if (notifError) {
    console.error('Failed to create notification:', notifError);
    return;
  }

  // 2. notification_settings 확인
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('key, value');

  const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
  const pushEnabled = settingsMap['push_enabled'] === 'true';
  const alimtalkEnabled = settingsMap['alimtalk_enabled'] === 'true';

  // 3. 회원 정보 조회 (전화번호, 푸시 토큰)
  const { data: member } = await supabase
    .from('members')
    .select('phone, push_token, push_enabled')
    .eq('id', params.memberId)
    .maybeSingle();

  if (!member) return;

  // 4. 푸시 발송 시도
  if (pushEnabled && member.push_token && member.push_enabled) {
    const result = await sendPush(member.push_token, params.title, params.message);
    await supabase.from('notification_logs').insert({
      notification_id: notification.id,
      channel: 'push',
      recipient: member.push_token,
      status: result.success ? 'sent' : 'failed',
      response: result.response ? JSON.parse(JSON.stringify(result.response)) : null,
      error_message: result.success ? null : result.message,
    });
    if (result.success) return; // 푸시 성공 시 알림톡 스킵
  }

  // 5. 알림톡 발송 시도 (푸시 미발송 시)
  if (alimtalkEnabled && member.phone) {
    const result = await sendAlimtalk(member.phone, params.type, params.message);
    await supabase.from('notification_logs').insert({
      notification_id: notification.id,
      channel: 'alimtalk',
      recipient: member.phone,
      status: result.success ? 'sent' : 'failed',
      response: result.response ? JSON.parse(JSON.stringify(result.response)) : null,
      error_message: result.success ? null : result.message,
    });
  } else {
    // 모두 비활성화 → disabled 로그만
    await supabase.from('notification_logs').insert({
      notification_id: notification.id,
      channel: 'alimtalk',
      recipient: member.phone || 'unknown',
      status: 'disabled',
      error_message: 'All notification channels disabled',
    });
  }
}
