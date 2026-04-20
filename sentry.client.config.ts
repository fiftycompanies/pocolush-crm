/**
 * Sentry 클라이언트 init (P1-d)
 * - DSN 없으면 skip
 * - tracesSampleRate: 0.1 (Free 한도 보호)
 * - replaysSessionSampleRate: 0 (OFF — Free 50/month 보호)
 * - replaysOnErrorSampleRate: 0 (OFF)
 *   → 추후 Phase 2b 이후 필요 시 0.1 로 조정 (D45)
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // PII redaction (PIPA 2026)
    sendDefaultPii: false,
    beforeSend(event) {
      // 사용자 입력 정보 제거 (request.data 마스킹)
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = { __redacted: true };
      }
      return event;
    },
  });
}
