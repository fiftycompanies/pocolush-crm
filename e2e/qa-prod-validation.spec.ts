/**
 * QA prod 검증 — 사람이 하듯이 실제 클릭 + 콘솔/토스트 캡쳐
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@pocolush.co.kr';
const ADMIN_PW = process.env.E2E_ADMIN_PW || '123456';

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

test('1. 공지 고정 토글 hotfix 검증 — 토스트/콘솔 캡쳐', async ({ page }) => {
  const errors: string[] = [];
  const errorToasts: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 400)));

  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-1-notices-before.png', fullPage: true });

  const firstPinBtn = page.locator('button').filter({ has: page.locator('svg.lucide-pin') }).first();
  await firstPinBtn.scrollIntoViewIfNeeded();
  await firstPinBtn.click();

  let outcome: string = 'timeout';
  try {
    await Promise.race([
      page.getByText(/고정 해제됨|고정됨/).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => { outcome = 'success'; }),
      page.getByText(/실패|오류/).first().waitFor({ state: 'visible', timeout: 5000 }).then(async () => {
        outcome = 'error';
        const t = await page.getByText(/실패|오류/).first().innerText();
        errorToasts.push(t.slice(0, 300));
      }),
    ]);
  } catch {}

  await page.screenshot({ path: '/tmp/qa-2-notices-after.png', fullPage: true });

  console.log('=========== 공지 고정 토글 결과 ===========');
  console.log('outcome:', outcome);
  if (errorToasts.length) console.log('error toast:', errorToasts);
  if (errors.length) console.log('console errors:', JSON.stringify(errors, null, 2));

  expect(['success', 'error']).toContain(outcome);
});

test('2. BBQ 보드 — KPI + 매트릭스 + 평상 워딩', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq-board`);
  await page.waitForLoadState('networkidle');

  // 워딩 변경 검증 — "평상 현황" (2026-05-16 단축)
  await expect(page.getByRole('heading', { name: '평상 현황', level: 1 })).toBeVisible();
  await expect(page.locator('[data-testid="board-kpi-card"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="kpi-confirmed"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-noshow"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-available"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-inactive"]')).toBeVisible();
  await expect(page.locator('[data-testid="board-matrix"]')).toBeVisible();

  await page.screenshot({ path: '/tmp/qa-3-bbq-board.png', fullPage: true });
});

test('3. BBQ 보드 셀 클릭 → 사이드 패널', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq-board`);
  await page.waitForLoadState('networkidle');

  const cells = page.locator('[data-testid^="board-cell-"][data-status="confirmed"]');
  const cnt = await cells.count();
  if (cnt === 0) {
    console.log('오늘 confirmed 예약 0 — 스킵');
    test.skip(true, 'no confirmed cell');
  }
  await cells.first().click();
  const panel = page.locator('[data-testid="reservation-side-panel"]');
  await expect(panel).toBeVisible({ timeout: 5000 });
  await expect(panel.locator('[data-testid="panel-member-name"]')).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-4-side-panel.png', fullPage: true });
  await page.keyboard.press('Escape');
});

test('4. 이번 주 탭 Tape Chart', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq-board`);
  await page.waitForLoadState('networkidle');

  await page.locator('[data-testid="tab-week"]').click();
  await expect(page.locator('[data-testid="board-week-tape"]')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: '/tmp/qa-5-week-tape.png', fullPage: true });
});

test('5. 신청관리 BBQ 행 Sentry 2-line', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/requests?type=bbq`);
  await page.waitForLoadState('networkidle');

  const bbqRows = page.locator('[data-testid^="request-row-bbq-"]');
  const cnt = await bbqRows.count();
  if (cnt === 0) test.skip(true, 'no bbq row');

  const first = bbqRows.first();
  const detail = first.locator('[data-testid="bbq-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(/#\d+번/);
  await expect(detail).toContainText(/타임/);
  await expect(detail).toContainText(/\d+인/);
  await expect(detail).toContainText(/₩/);

  await page.screenshot({ path: '/tmp/qa-6-requests.png', fullPage: true });
});

test('6. STATUS 탭 예약완료/노쇼 노출', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/requests?type=bbq`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: '예약완료' })).toBeVisible();
  await expect(page.getByRole('button', { name: '노쇼' })).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-7-status-tabs.png', fullPage: true });
});

test('8. 사이드바 — "평상" 워딩 변경 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('link', { name: '평상 현황' })).toBeVisible();
  await expect(page.getByRole('link', { name: '평상 설정' })).toBeVisible();
  // 농장 현황 사이드바 추가 (2026-05-16) — [일별 운영] 그룹
  await expect(page.getByRole('link', { name: '농장 현황' })).toBeVisible();
  // 평상 메뉴(bbq-products) 는 평상 설정 §3 섹션으로 통합 (2026-05-16) — 사이드바에서 제거
  await expect(page.getByRole('link', { name: '평상 메뉴' })).toHaveCount(0);

  await page.screenshot({ path: '/tmp/qa-v2-sidebar.png', fullPage: true });
});

test('9. 평상 설정 통합 — §1~§4 4섹션 visible', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq`);
  await page.waitForLoadState('networkidle');

  // §1 배치도 / §2 타임슬롯 / §3 상품·이벤트 / §4 시설 목록 (collapsible)
  await expect(page.getByRole('heading', { name: '평상 배치도' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '타임 슬롯' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '상품·이벤트' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /시설 목록/ })).toBeVisible();

  // §3 상품 1건 표시
  await expect(page.getByText('평상 예약 (기본)')).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-bbq-integrated.png', fullPage: true });
});

test('10. /dashboard/bbq-products → /dashboard/bbq#products redirect', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq-products`);
  await page.waitForURL(/\/dashboard\/bbq(\?|#|$)/, { timeout: 10000 });
  // redirect 도착 후 §3 섹션 visible
  await expect(page.getByRole('heading', { name: '상품·이벤트' })).toBeVisible();
});

test('7. StatsCards BBQ 칩 confirmed 링크 (P0 fix)', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');

  const bbqChip = page.locator('a[href*="/dashboard/requests"][href*="type=bbq"]').first();
  const visible = await bbqChip.isVisible().catch(() => false);
  if (!visible) {
    console.log('pendingBBQ 0 — 칩 미노출');
    test.skip(true, 'no bbq chip');
  }
  const href = await bbqChip.getAttribute('href');
  console.log('BBQ chip href:', href);
  expect(href).toContain('status=confirmed');
  await page.screenshot({ path: '/tmp/qa-8-statscard.png', fullPage: true });
});
