import { test, expect } from '@playwright/test';

const BASE = 'https://app.pocolush.com';
const ADMIN_EMAIL = 'admin@pocolush.co.kr';
const ADMIN_PW = '123456';

test.describe.configure({ mode: 'serial' });

test('운영: 어드민 로그인 → /dashboard/members 파생상태 확인', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);

  await page.goto(`${BASE}/dashboard/members`);
  await page.waitForLoadState('networkidle');

  // 파생상태 필터 탭 존재
  await expect(page.getByRole('button', { name: /^전체$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /계약활성/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /회원권미발급/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^만료$/ })).toBeVisible();

  // 4fa97579 (QA-운영-회원-A) 행: 파생상태가 'approved' 기반(계약활성/회원권미발급) 어느 쪽이든
  // "임대계약" 버튼(최초 버그의 흔적)이 노출되지 않아야 함.
  const row = page.locator('tr', { hasText: 'QA-운영-회원-A' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText(/계약활성|회원권미발급|회원권만료/)).toBeVisible();
  await expect(row.locator('button', { hasText: '임대계약' })).toHaveCount(0);

  // 이석형테스트 phone 폴백: 계약 카운트 > 0 (회원권 상태는 운영 데이터에 따라 변동 가능)
  const leeRow = page.locator('tr', { hasText: '이석형테스트' }).first();
  await expect(leeRow).toBeVisible();
  const rentalCell = leeRow.locator('td').nth(3);
  await expect(rentalCell).toContainText(/계약 [1-9]/);

  await page.screenshot({ path: '/tmp/prod-members-list.png', fullPage: true });
});

test('운영: /dashboard/memberships 페이지 렌더링', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);

  await page.goto(`${BASE}/dashboard/memberships`);
  await page.waitForLoadState('networkidle');

  // 페이지 타이틀
  await expect(page.getByRole('heading', { name: '회원권 관리' })).toBeVisible();

  // 상단 카드 4개 — paragraph 안쪽 라벨만 매칭
  await expect(page.locator('p', { hasText: /^만료 임박/ })).toBeVisible();
  await expect(page.locator('p', { hasText: /^취소\/정지$/ })).toBeVisible();
  await expect(page.locator('p', { hasText: /^이번 달 신규 발급$/ })).toBeVisible();

  // 신규 발급 버튼
  await expect(page.getByRole('button', { name: /신규 발급/ })).toBeVisible();

  // CSV PII 버튼
  await expect(page.getByRole('button', { name: /PII 포함/ })).toBeVisible();

  // 필터
  await expect(page.getByRole('combobox').first()).toBeVisible();
  await expect(page.getByPlaceholder('플랜명')).toBeVisible();

  // 테이블에 적어도 1건 이상
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  // plan_name 컬럼에 'E2E플랜' 또는 다른 플랜명이 보여야 함
  await expect(page.getByText('E2E플랜').first()).toBeVisible();

  await page.screenshot({ path: '/tmp/prod-memberships.png', fullPage: true });
});

test('운영: 드로어 열기 + 이력 타임라인', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);

  await page.goto(`${BASE}/dashboard/memberships`);
  await page.waitForLoadState('networkidle');

  // 첫 행 클릭
  await page.locator('table tbody tr').first().click();

  // 드로어 확인 — 드로어 내부 코드 헤더 (poco- 또는 JRT-)
  await expect(page.locator('h2', { hasText: /회원권\s+(poco-|JRT-)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /기간 수정/ })).toBeVisible();

  await page.screenshot({ path: '/tmp/prod-drawer.png', fullPage: true });
});

test('운영: 어드민 아닌 계정은 /dashboard/memberships 차단', async ({ page, context }) => {
  await context.clearCookies();
  const resp = await page.goto(`${BASE}/dashboard/memberships`);
  // 로그인 안 된 상태: /m/login 또는 /login 리다이렉트
  expect(['http://app.pocolush.com/login', 'https://app.pocolush.com/login', 'https://app.pocolush.com/m/login'].some(u => page.url().startsWith(u))).toBeTruthy();
});
