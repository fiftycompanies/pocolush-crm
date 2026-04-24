/**
 * Next.js 16 instrumentation (P1-d)
 * - 앱 구동 시 1회 실행
 * - runtime 분기로 Sentry 서버/엣지 config 동적 로드
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js 16 onRequestError 훅 (서버 에러를 Sentry로 포워드)
// 시그니처는 Next.js runtime 이 제공하는 request/context 객체에 의존.
// Sentry 는 captureRequestError 를 자체 시그니처로 정의 → 타입 uncheck 로 위임
export const onRequestError: (
  err: unknown,
  request: unknown,
  context: unknown,
) => void | Promise<void> = async (err, request, context) => {
  const Sentry = await import('@sentry/nextjs');
  // @ts-expect-error — Next 16 runtime shape 과 Sentry 내부 타입 차이
  Sentry.captureRequestError(err, request, context);
};
