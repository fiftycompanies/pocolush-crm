/**
 * GuideModal E2E — Phase 0.5 PR-H2
 *
 * 검증:
 * - 회원가입 페이지 "이용가이드 보기" 버튼 → 모달 오픈
 * - ESC / 배경 클릭 / X 버튼 닫기
 * - 포커스 복귀 (트리거 요소)
 * - Tab focus trap
 * - PDF 다운로드 버튼 노출 (NEXT_PUBLIC_GUIDE_PDF_URL 설정 여부 따라)
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';

async function openSignupAndModal(page: Page) {
  await page.goto(`${BASE}/m/signup`);
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: /자람터 이용 가이드 보기/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.locator('[role=dialog]');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  return { dialog, trigger };
}

test.describe('GuideModal', () => {
  test.describe.configure({ mode: 'serial' });

  test('GM-1: 회원가입 페이지에서 이용가이드 버튼 → 모달 열림', async ({ page }) => {
    const { dialog } = await openSignupAndModal(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledby = await dialog.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    await expect(dialog.locator('#guide-modal-title')).toBeVisible();
    await expect(dialog.locator('text=/자람터|이용.?가이드|운영/').first()).toBeVisible();
  });

  test('GM-2: ESC 키로 모달 닫힘', async ({ page }) => {
    const { dialog } = await openSignupAndModal(page);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('GM-3: 배경 클릭으로 모달 닫힘', async ({ page }) => {
    const { dialog } = await openSignupAndModal(page);
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('GM-4: 닫기 버튼(X)으로 모달 닫힘 + 트리거 포커스 복귀', async ({ page }) => {
    const { dialog, trigger } = await openSignupAndModal(page);
    const closeBtn = dialog.getByRole('button', { name: /가이드 닫기/ });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    await expect(trigger).toBeFocused();
  });

  test('GM-5: PDF 다운로드 링크 속성 검증 (설정 시)', async ({ page }) => {
    const { dialog } = await openSignupAndModal(page);
    const dl = dialog.getByRole('link', { name: /PDF 다운로드/ });
    const visible = await dl.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'NEXT_PUBLIC_GUIDE_PDF_URL 미설정 — 다운로드 버튼 미노출 정상');
      return;
    }
    const href = await dl.getAttribute('href');
    expect(href).toMatch(/^https:\/\/.+\.pdf$/);
    expect(await dl.getAttribute('target')).toBe('_blank');
    expect(await dl.getAttribute('rel')).toMatch(/noopener/);
  });

  test('GM-6: Tab focus trap — 모달 내부에서만 순환', async ({ page }) => {
    const { dialog } = await openSignupAndModal(page);
    const closeBtn = dialog.getByRole('button', { name: /가이드 닫기/ });
    await expect(closeBtn).toBeFocused();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }
    const focusedInDialog = await page.evaluate(() => {
      const dlg = document.querySelector('[role=dialog]');
      return !!dlg && !!dlg.contains(document.activeElement);
    });
    expect(focusedInDialog).toBeTruthy();
  });
});
