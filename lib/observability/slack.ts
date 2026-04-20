/**
 * Slack Webhook 알람 전송 유틸 (K-4 확정)
 * - 전용 워크스페이스 pocolush-ops (#alerts + #standup)
 * - env: SLACK_WEBHOOK_URL
 * - 실패 swallow (알람 자체가 앱을 망가뜨리지 않도록)
 */

type SlackLevel = 'info' | 'warn' | 'error' | 'critical';

const LEVEL_EMOJI: Record<SlackLevel, string> = {
  info: ':information_source:',
  warn: ':warning:',
  error: ':rotating_light:',
  critical: ':fire:',
};

const LEVEL_COLOR: Record<SlackLevel, string> = {
  info: '#3B82F6',
  warn: '#F59E0B',
  error: '#EF4444',
  critical: '#991B1B',
};

export interface SlackAlertInput {
  level: SlackLevel;
  title: string;
  message?: string;
  fields?: Record<string, string | number | boolean | null | undefined>;
  link?: string;
  channel?: 'alerts' | 'standup'; // default: alerts
}

/**
 * Slack #alerts (기본) 또는 #standup 으로 알람 전송.
 * - webhook URL 미설정 시 console.warn 후 no-op
 * - fetch 타임아웃 5초
 */
export async function slackAlert(input: SlackAlertInput): Promise<{ ok: boolean; reason?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn('[slack] SLACK_WEBHOOK_URL 미설정 — no-op', { title: input.title });
    return { ok: false, reason: 'no_webhook_url' };
  }

  const fields = input.fields
    ? Object.entries(input.fields)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ({ title: k, value: String(v), short: true }))
    : [];

  const body = {
    attachments: [{
      color: LEVEL_COLOR[input.level],
      fallback: `${input.title} — ${input.message ?? ''}`,
      title: `${LEVEL_EMOJI[input.level]} ${input.title}`,
      text: input.message,
      fields,
      footer: `pocolush-crm · ${process.env.VERCEL_ENV ?? 'local'}`,
      ts: Math.floor(Date.now() / 1000),
      actions: input.link ? [{ type: 'button', text: '열기', url: input.link }] : undefined,
    }],
  };

  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(tm);
    if (!res.ok) {
      console.error('[slack] webhook non-2xx:', res.status);
      return { ok: false, reason: `status_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    // swallow — 알람 자체가 앱 실패 원인이 되지 않도록
    console.error('[slack] webhook 실패:', e);
    return { ok: false, reason: 'fetch_error' };
  }
}
