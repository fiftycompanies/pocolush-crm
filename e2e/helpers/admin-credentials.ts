/**
 * E2E 어드민 인증 정보 (2026-05-16)
 *
 * 보안:
 *   - 평문 비밀번호 git 커밋 금지 (PR-X 적용)
 *   - 환경변수 미설정 시 throw → CI/local 모두 명시적 설정 강제
 *
 * 설정 방법:
 *   - local: .env.local 에 E2E_ADMIN_EMAIL, E2E_ADMIN_PW 추가
 *   - CI: GitHub Secrets 에 E2E_ADMIN_EMAIL, E2E_ADMIN_PW 등록 후
 *     pr-check.yml / e2e-full.yml 의 env: 블록에 secrets.E2E_ADMIN_PW 매핑
 *
 * Note: prod 어드민 비번 자체는 별도 rotation 필요 (이전 평문 노출 사항)
 */

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `[E2E] ${key} 환경변수가 필요합니다. .env.local 또는 GitHub Secrets 에 설정하세요.`,
    );
  }
  return v;
}

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@pocolush.co.kr';
export const ADMIN_PW = requireEnv('E2E_ADMIN_PW');
