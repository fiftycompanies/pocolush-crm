/**
 * FCM 푸시 클라이언트 (P1-e · K-2 결정 반영)
 *
 * - env: FCM_SERVICE_ACCOUNT (base64 encoded JSON) — .env.example Tier 0 와 통일
 *   (구 FIREBASE_SERVICE_ACCOUNT 는 fallback 으로만 허용, 점진 제거)
 * - firebase-admin Singleton (Next.js hot-reload 안전)
 * - 무효 토큰(registration-token-not-registered, invalid-argument) 감지 시
 *   `tokenInvalid: true` 리턴 → 호출자가 `members.push_token = NULL` 처리
 * - 서버 전용 — 클라이언트에서 import 금지
 */

import 'server-only';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { slackAlert } from './observability/slack';

export interface SendResult {
  success: boolean;
  message: string;
  messageId?: string;
  /** 토큰이 영구 무효 — 호출자가 DB에서 제거해야 함 */
  tokenInvalid?: boolean;
  response?: unknown;
}

// ───────────────────────────────────────
// Singleton init
// ───────────────────────────────────────
let cachedApp: App | null = null;
let cachedMessaging: Messaging | null = null;
let initAttempted = false;
let initFailReason: string | null = null;

function initMessaging(): Messaging | null {
  if (cachedMessaging) return cachedMessaging;
  if (initAttempted) return null;
  initAttempted = true;

  const base64 = process.env.FCM_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!base64) {
    initFailReason = 'FCM_SERVICE_ACCOUNT 미설정';
    return null;
  }

  try {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const credentials = JSON.parse(json);

    // hot-reload / 중복 init 방지
    const existing = getApps();
    cachedApp = existing.length > 0 ? existing[0] : initializeApp({ credential: cert(credentials) });
    cachedMessaging = getMessaging(cachedApp);
    return cachedMessaging;
  } catch (e) {
    initFailReason = `init 실패: ${e instanceof Error ? e.message : String(e)}`;
    void slackAlert({
      level: 'critical',
      title: 'FCM init 실패',
      message: initFailReason,
      fields: { env: process.env.VERCEL_ENV ?? 'local' },
    });
    return null;
  }
}

// ───────────────────────────────────────
// Public API
// ───────────────────────────────────────

/**
 * 단일 토큰 푸시 전송.
 * - 성공: { success: true, messageId: '...' }
 * - 무효 토큰: { success: false, tokenInvalid: true, message: ... }
 * - 일시적 실패: { success: false, message: ... }
 */
export async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<SendResult> {
  if (!token) {
    return { success: false, message: 'EMPTY_TOKEN', tokenInvalid: true };
  }

  const messaging = initMessaging();
  if (!messaging) {
    return { success: false, message: initFailReason ?? 'FCM_NOT_CONFIGURED' };
  }

  try {
    const messageId = await messaging.send({
      token,
      notification: { title, body },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
      android: {
        priority: 'high',
        notification: { channelId: 'default' },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } },
      },
    });
    return { success: true, message: 'SENT', messageId };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; errorInfo?: { code?: string } };
    const code = err.code ?? err.errorInfo?.code ?? '';

    // 영구 무효 토큰
    const invalidCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
      'messaging/invalid-registration-token',
    ];
    if (invalidCodes.some(c => code.includes(c))) {
      return {
        success: false,
        tokenInvalid: true,
        message: code,
        response: e,
      };
    }

    // 일시적 실패 (네트워크, rate limit 등)
    return {
      success: false,
      message: err.message ?? code ?? 'UNKNOWN_FCM_ERROR',
      response: e,
    };
  }
}

/**
 * 무효 토큰 정리 (optional helper).
 * - 호출자가 sendPush 결과 tokenInvalid=true 확인 시 호출
 * - 여기서는 Supabase client 로 members.push_token=NULL 처리
 *
 * 실제 호출은 `lib/notifications.ts` 의 sendNotification 에서 수행.
 */
export async function invalidateMemberPushToken(
  supabaseAdmin: {
    from: (table: string) => {
      update: (patch: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  memberId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('members')
    .update({ push_token: null })
    .eq('id', memberId);
  if (error) {
    console.error('[fcm] invalidateMemberPushToken 실패:', error.message);
  }
}
