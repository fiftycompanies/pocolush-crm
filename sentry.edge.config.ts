/**
 * Sentry Edge runtime init (P1-d)
 * - middleware.ts + edge route handler 용
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'local',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
