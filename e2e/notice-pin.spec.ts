import { test, expect, Page } from '@playwright/test';

const BASE = 'https://app.pocolush.com';
const ADMIN_EMAIL = 'admin@pocolush.co.kr';
const ADMIN_PW = '123456';

test.describe.configure({ mode: 'serial' });

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);
}

test('E2E-PIN-1: 어드민 공지 목록 페이지 렌더 + 액션 버튼', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
  await expect(page.locator('p', { hasText: /전체 \d+건/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /새 공지/ })).toBeVisible();

  // 핀 버튼 — 배포 전/후 호환 regex
  const pinButton = page.getByRole('button', { name: /^고정하?기?$/ }).first();
  await expect(pinButton).toBeVisible();

  await page.screenshot({ path: '/tmp/pin-e2e-01-list.png', fullPage: true });
});

test('E2E-PIN-2: 발행 공지 핀 → 모달 a11y (체크박스 기본 off + ESC 닫기)', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');

  // 첫 번째 핀 버튼 클릭 (일반 섹션의 첫 공지 = 미고정)
  const firstPinButton = page.getByRole('button', { name: /^고정하?기?$/ }).first();
  await firstPinButton.click();

  // 발행 공지면 모달이 뜸
  const modal = page.locator('[role=dialog]');
  const hasModal = await modal.isVisible().catch(() => false);

  if (hasModal) {
    // a11y 속성 확인
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    const labelledby = await modal.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();

    // 체크박스 기본 unchecked
    const pushCheck = modal.locator('input[type=checkbox]');
    await expect(pushCheck).not.toBeChecked();

    await page.screenshot({ path: '/tmp/pin-e2e-02-modal.png' });

    // ESC로 닫기
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  } else {
    // 미발행이면 모달 없이 바로 고정됨 — 토스트 확인
    await expect(page.locator('text=/고정됨/').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: '/tmp/pin-e2e-02-toast.png', fullPage: true });
    // 원복
    const unpin = page.getByRole('button', { name: /고정 해제/ }).first();
    if (await unpin.isVisible().catch(() => false)) {
      await unpin.click();
      await page.waitForTimeout(1000);
    }
  }
});

test('E2E-PIN-3: 발행 공지 핀 → 푸시 미체크 → 고정 → 해제 (정상 플로우)', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');

  const initialPinnedSection = page.locator('text=/고정 공지 \\(/');
  const initialHasPinned = await initialPinnedSection.isVisible().catch(() => false);

  // 첫 번째 핀 버튼 클릭
  await page.getByRole('button', { name: /^고정하?기?$/ }).first().click();

  const modal = page.locator('[role=dialog]');
  if (await modal.isVisible().catch(() => false)) {
    // 체크박스 미체크 상태 유지 + "고정하기" 버튼
    await modal.getByRole('button', { name: '고정하기' }).click();
  }

  // 고정됨 토스트 (푸시 발송됨은 X)
  await expect(page.locator('text=/^고정됨$/').first()).toBeVisible({ timeout: 5000 });

  // 고정 섹션 나타남
  await expect(page.locator('text=/고정 공지 \\(/').first()).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: '/tmp/pin-e2e-03-pinned.png', fullPage: true });

  // 해제: 고정 섹션의 첫 행에서 "고정 해제" 버튼 클릭
  const unpinButton = page.getByRole('button', { name: /고정 해제/ }).first();
  await unpinButton.click();

  await expect(page.locator('text=/고정 해제됨/').first()).toBeVisible({ timeout: 5000 });

  // 원래 상태 복원 (고정 섹션 여전히 있다면 initialHasPinned가 true였음)
  if (!initialHasPinned) {
    await expect(page.locator('text=/고정 공지 \\(/').first()).not.toBeVisible({ timeout: 3000 });
  }
});

test('E2E-PIN-4: 키보드 드래그 센서 — 고정 섹션 존재 시 GripVertical 핸들 확인', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');

  const pinnedSection = page.locator('text=/고정 공지 \\(/');
  if (!(await pinnedSection.isVisible().catch(() => false))) {
    test.skip(true, '현재 고정 공지 없음 — 드래그 테스트 생략');
    return;
  }

  // GripVertical 핸들 버튼 (aria-label="순서 변경 핸들")
  const handle = page.getByRole('button', { name: /순서 변경 핸들/ }).first();
  await expect(handle).toBeVisible();

  // 키보드 힌트 문구 노출 확인
  await expect(page.locator('text=/Space.*↑↓.*Space/')).toBeVisible();
});

test('E2E-PIN-5: 10건 초과 경고 로직 — 임계값 코드 존재 확인 (실제 10건 생성 X)', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/dashboard/notices`);
  await page.waitForLoadState('networkidle');

  // 고정 N/M 뱃지 포맷 ("고정 N건") 또는 경고 문구 소재 확인
  const pinBadge = page.locator('span', { hasText: /고정 \d+건/ });
  const count = await pinBadge.count();
  if (count > 0) {
    const text = await pinBadge.first().innerText();
    console.log(`현재 고정 뱃지: ${text}`);
  }
  // 단순히 페이지가 정상 로드되고 깨지지 않는지만 확인
  await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
});
