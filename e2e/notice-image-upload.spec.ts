/**
 * 공지 이미지 업로드 E2E — PR-H3
 *
 * 어드민 로그인 + 새 공지 작성 페이지에서 드롭존 + 썸네일 흐름 검증.
 *
 * ⚠️ data write 최소화:
 * - draft_id 생성은 페이지 마운트 시 자동 (UI 경로). 제출 X → prod write 를 꼭 필요한 최소로.
 * - 실제 Storage 업로드는 prod 환경에서 스킵 (ALLOW_PROD_WRITE 필요).
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@pocolush.co.kr';
const ADMIN_PW = process.env.E2E_ADMIN_PW || '123456';

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);
}

test.describe('Notice image upload (PR-H3)', () => {
  test.describe.configure({ mode: 'serial' });

  test('NI-1: 드롭존 렌더 + 라벨 "이미지 첨부"', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices/new`);
    await page.waitForLoadState('networkidle');
    const fieldset = page.getByRole('group', { name: /이미지 첨부/ });
    await expect(fieldset).toBeVisible();
    await expect(fieldset).toContainText(/최대 10장/);
    await expect(fieldset).toContainText(/2MB/);
  });

  test('NI-2: 드롭존 키보드 포커스 가능', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices/new`);
    await page.waitForLoadState('networkidle');
    const dropzone = page.getByRole('button', { name: /이미지 파일을 여기에 드롭/ });
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toHaveAttribute('aria-disabled', 'false', { timeout: 10_000 });
    await dropzone.focus();
    await expect(dropzone).toBeFocused();
  });

  test('NI-3: draft_id 생성 후 드롭존 활성 — "공지 먼저 저장" 문구 사라짐', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=/공지를 먼저 저장/')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/드래그하거나.*클릭/')).toBeVisible();
  });

  test('NI-4: accept 속성 — JPEG/PNG/WebP만 (SVG 차단)', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices/new`);
    await page.waitForLoadState('networkidle');
    const input = page.locator('input[type="file"]');
    const accept = await input.getAttribute('accept');
    expect(accept).toBe('image/jpeg,image/png,image/webp');
    const multiple = await input.getAttribute('multiple');
    expect(multiple).not.toBeNull();
  });

  test('NI-5: EDIT 페이지 진입 시 드롭존 렌더 (noticeId 즉시 전달)', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices`);
    await page.waitForLoadState('networkidle');
    const editLink = page.locator('a[href*="/edit"]').first();
    const hasEdit = await editLink.isVisible().catch(() => false);
    if (!hasEdit) {
      test.skip(true, '편집 가능한 공지 없음 — 스킵');
      return;
    }
    await editLink.click();
    await page.waitForURL(/\/edit/);
    await page.waitForLoadState('networkidle');
    const fieldset = page.getByRole('group', { name: /이미지 첨부/ });
    await expect(fieldset).toBeVisible();
    const dropzone = page.getByRole('button', { name: /이미지 파일을 여기에 드롭/ });
    await expect(dropzone).toHaveAttribute('aria-disabled', 'false');
  });

  test('NI-6: 드롭존 aria-busy 기본값 false', async ({ page }) => {
    await adminLogin(page);
    await page.goto(`${BASE}/dashboard/notices/new`);
    await page.waitForLoadState('networkidle');
    const fieldset = page.locator('fieldset').filter({ hasText: /이미지 첨부/ });
    await expect(fieldset).toHaveAttribute('aria-busy', 'false');
  });

  // TODO Phase 0.5 후속: 실제 파일 업로드 + 2MB 초과 rejection + 10장 초과 차단
  //  (ALLOW_PROD_WRITE=yes 환경에서만 실행 예정)
  test.skip('NI-7: 2MB 초과 파일 — 클라이언트 rejection 메시지', async () => {
    // TODO
  });
  test.skip('NI-8: 10장 초과 — 사전 차단 toast', async () => {
    // TODO
  });
  test.skip('NI-9: 업로드 성공 → 커서 위치에 ![](url) 자동 삽입', async () => {
    // TODO
  });
});
