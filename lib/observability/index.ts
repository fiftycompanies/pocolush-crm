/**
 * 관측 스택 통합 re-export (P1-d)
 * - Sentry: sentry.{client,server,edge}.config.ts 에서 init
 * - Axiom: lib/observability/axiom.ts
 * - Slack: lib/observability/slack.ts
 *
 * 사용 예:
 *   import { slackAlert, axiomLog } from '@/lib/observability';
 *   slackAlert({ level: 'error', title: 'X 실패', message: err.message });
 */

export { slackAlert, type SlackAlertInput } from './slack';
export { axiomLog, type AxiomEvent } from './axiom';

// Sentry 는 @sentry/nextjs 의 captureException 직접 사용 권장:
//   import * as Sentry from '@sentry/nextjs';
//   Sentry.captureException(err);
