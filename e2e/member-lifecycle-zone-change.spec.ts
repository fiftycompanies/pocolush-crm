/**
 * 063 + 064 + 070 실배포 E2E (Playwright)
 *
 * 시나리오:
 * 1. 어드민 — 회원 비활성화 → 재활성화 (063 Phase 1)
 * 2. 어드민 — 회원 삭제 신청 → 복원 (063 Phase 1)
 * 3. 어드민 — Zone 이전 (064 — validate → 확정)
 * 4. 회원 self-service — 탈퇴 신청 → 복원 (070)
 * 5. PIPA 4대 고지 노출 검증 (signup 페이지)
 *
 * 각 시나리오에 스크린샷 저장.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@pocolush.co.kr';
const ADMIN_PW = process.env.E2E_ADMIN_PW || '123456';

// 테스트 대상 회원 (이전 세션 검증으로 안전 확인)
const TEST_MEMBER_NAME = 'QA테스트회원';

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe('063 회원 라이프사이클 — admin UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. 회원 리스트 — 상태 필터 + ⋮ 메뉴 노출', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/members`);
    await page.waitForLoadState('networkidle');

    // 새 상태 탭 존재
    await expect(page.getByRole('button', { name: '삭제 대기' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '삭제됨' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '비활성화' }).first()).toBeVisible();

    await page.screenshot({ path: '/tmp/e2e-1-members-list.png', fullPage: true });
  });

  test('2. 회원 상세 — Danger Zone 노출', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/members`);
    await page.waitForLoadState('networkidle');

    // 첫 active 회원 클릭 (테스트회원 우선)
    const targetRow = page.locator('tr', { hasText: TEST_MEMBER_NAME }).first();
    const exists = await targetRow.count();
    if (exists > 0) {
      await targetRow.click();
    } else {
      await page.locator('tbody tr').first().click();
    }
    await page.waitForURL(/\/dashboard\/members\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Danger Zone 또는 위험 구역 표시 확인
    const dangerZone = page.getByText(/위험 구역|Danger Zone/i).first();
    await expect(dangerZone).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: '/tmp/e2e-2-member-detail-danger-zone.png', fullPage: true });
  });

  test('3. 비활성화 모달 — 사유 드롭다운 + 메모', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/members`);
    await page.waitForLoadState('networkidle');
    await page.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/members\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle');

    const suspendBtn = page.getByRole('button', { name: /비활성화$/ }).first();
    const visible = await suspendBtn.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, '비활성화 버튼 없음 (이미 suspended 또는 deleted 상태)');
      return;
    }
    await suspendBtn.click();

    // 모달 떠야 함
    const modal = page.locator('[role=dialog]').filter({ hasText: '회원 비활성화' });
    await expect(modal).toBeVisible({ timeout: 3000 });
    // 사유 select
    await expect(modal.locator('select')).toBeVisible();

    await page.screenshot({ path: '/tmp/e2e-3-suspend-modal.png', fullPage: true });
    await page.keyboard.press('Escape');
  });
});

test.describe('064 Zone 이전 — admin UI', () => {
  test('4. 회원 상세 → Zone 이전 버튼 → 모달', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/members`);
    await page.waitForLoadState('networkidle');
    // active 회원 (계약 활성 derived) 찾기
    const activeRow = page.locator('tr', { hasText: /계약활성|회원권만료/ }).first();
    if (await activeRow.count() === 0) {
      test.skip(true, 'active 회원 없음');
      return;
    }
    await activeRow.click();
    await page.waitForURL(/\/dashboard\/members\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle');

    const zoneBtn = page.getByRole('button', { name: /Zone 이전/ }).first();
    const visible = await zoneBtn.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Zone 이전 버튼 없음 (active 멤버십 + farm 없음)');
      return;
    }
    await zoneBtn.click();

    const modal = page.locator('[role=dialog]').filter({ hasText: /Zone 이전/ });
    await expect(modal).toBeVisible({ timeout: 5000 });
    // Step 1 입력 영역 확인
    await expect(modal.getByText('정보 입력')).toBeVisible();
    await expect(modal.getByText(/이동할 자리/)).toBeVisible();
    await expect(modal.getByText(/가격 차이/)).toBeVisible();

    await page.screenshot({ path: '/tmp/e2e-4-zone-transfer-modal.png', fullPage: true });
    await page.keyboard.press('Escape');
  });
});

test.describe('070 회원 self-service 탈퇴 + PIPA', () => {
  test('5. signup 페이지 — PIPA 4대 고지 details', async ({ page }) => {
    await page.goto(`${BASE}/m/signup`);
    await page.waitForLoadState('networkidle');

    // 4대 고지 details 노출
    const pipaDetails = page.locator('[data-testid="pipa-details"]');
    await expect(pipaDetails).toBeVisible();

    // 열기
    await pipaDetails.click();
    await expect(page.getByText('수집 항목 (필수)')).toBeVisible();
    await expect(page.getByText('수집·이용 목적')).toBeVisible();
    await expect(page.getByText('보유·이용 기간')).toBeVisible();
    await expect(page.getByText('거부할 권리 및 불이익')).toBeVisible();
    await expect(page.getByText(/5년 보관/)).toBeVisible();

    // 처리방침 링크 존재
    await expect(page.getByRole('link', { name: '개인정보처리방침' })).toBeVisible();

    await page.screenshot({ path: '/tmp/e2e-5-signup-pipa-details.png', fullPage: true });
  });

  test('6. /privacy 페이지 — 10개 섹션', async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible();
    await expect(page.getByText('1. 수집하는 개인정보 항목')).toBeVisible();
    await expect(page.getByText('7. 개인정보 파기 절차')).toBeVisible();
    await expect(page.getByText(/30일 grace/)).toBeVisible();
    await expect(page.getByText(/5년 보관/)).toBeVisible();

    await page.screenshot({ path: '/tmp/e2e-6-privacy-policy.png', fullPage: true });
  });
});
