/**
 * Sentry 서버(Node runtime) init (P1-d)
 * - /app/api/* 및 서버 컴포넌트에서 동작
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'local',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // 서버 로그에서 민감 정보 마스킹 (PIPA 2026)
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        if (h.authorization) h.authorization = '[REDACTED]';
        if (h.cookie) h.cookie = '[REDACTED]';
      }
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = { __redacted: true };
      }
      return event;
    },
  });
}
