import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 설정 (P1-b: v3.1 §4-6 준수)
 * - ALLOW_PROD_WRITE default-deny: "yes" exact match 없으면 prod URL 차단
 * - retries: CI 환경 1회, 로컬 0
 * - trace: on-first-retry (SRK 노출 완화)
 * - fullyParallel: false (단일 Staging DB 격리)
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const allowProdWrite = process.env.ALLOW_PROD_WRITE === 'yes'; // exact match
const isProdHost = /pocolush\.com/.test(baseURL);

// Config 로딩 시점 throw — spec 레벨 skip 보다 강한 방어선
if (isProdHost && !allowProdWrite) {
  throw new Error(
    `[BLOCKED] PLAYWRIGHT_BASE_URL="${baseURL}" 가 prod 호스트로 감지됨. ` +
    `쓰기 테스트 실행하려면 ALLOW_PROD_WRITE=yes 명시 필요 (default: deny).`
  );
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
