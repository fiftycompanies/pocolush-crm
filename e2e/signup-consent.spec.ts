/**
 * 회원가입 2-way 동의 체크박스 E2E — PR-H1a
 *
 * 검증:
 * - 두 체크박스 모두 독립 존재 (guide + privacy)
 * - 환불규정 3줄 요약 노출 (전자상거래법 §13)
 * - 가이드 동의만 체크 → 버튼 여전히 비활성
 * - 개인정보 동의만 체크 → 버튼 여전히 비활성
 * - 둘 다 체크 → 버튼 활성화
 * - "이용가이드 보기" 버튼은 체크박스 라벨 외부 (독립 버튼)
 * - 실제 제출은 하지 않음 (prod write 방지)
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';

async function goSignup(page: Page) {
  await page.goto(`${BASE}/m/signup`);
  await page.waitForLoadState('networkidle');
}

test.describe('Signup consent (PIPA §22① 2-way split)', () => {
  test.describe.configure({ mode: 'serial' });

  test('SC-1: 두 체크박스 모두 존재 (guide + privacy) + 독립 라벨', async ({ page }) => {
    await goSignup(page);
    const guideDesc = page.locator('#guide-consent-desc');
    await expect(guideDesc).toBeVisible();
    await expect(guideDesc).toContainText(/자람터 주말농장 이용 가이드/);
    const privacyDesc = page.locator('#privacy-consent-desc');
    await expect(privacyDesc).toBeVisible();
    await expect(privacyDesc).toContainText(/개인정보 수집·이용/);
  });

  test('SC-2: 환불규정 3줄 요약 노출 (전자상거래법 §13)', async ({ page }) => {
    await goSignup(page);
    await expect(page.locator('text=/환불 규정 요약/')).toBeVisible();
    await expect(page.locator('text=/계약 후.*7일.*100%/')).toBeVisible();
    await expect(page.locator('text=/이용시작.*30일.*50%/')).toBeVisible();
    await expect(page.locator('text=/이후.*환불.?불가/')).toBeVisible();
  });

  test('SC-3: 제출 버튼은 두 체크박스 모두 체크해야 활성화', async ({ page }) => {
    await goSignup(page);
    const submitBtn = page.getByRole('button', { name: /회원가입$/ });
    await expect(submitBtn).toBeDisabled();

    const guideCheckbox = page.locator('input[aria-describedby="guide-consent-desc"]');
    await guideCheckbox.check();
    await expect(submitBtn).toBeDisabled();

    await guideCheckbox.uncheck();
    const privacyCheckbox = page.locator('input[aria-describedby="privacy-consent-desc"]');
    await privacyCheckbox.check();
    await expect(submitBtn).toBeDisabled();

    await guideCheckbox.check();
    await expect(submitBtn).toBeEnabled();
  });

  test('SC-4: "이용가이드 보기" 버튼은 체크박스 라벨 외부 — 독립 버튼', async ({ page }) => {
    await goSignup(page);
    const guideButton = page.getByRole('button', { name: /자람터 이용 가이드 보기/ });
    await expect(guideButton).toBeVisible();
    const isNestedInLabel = await guideButton.evaluate((el) => {
      let cur: HTMLElement | null = el;
      while (cur) {
        if (cur.tagName === 'LABEL') return true;
        cur = cur.parentElement;
      }
      return false;
    });
    expect(isNestedInLabel).toBe(false);
  });

  test('SC-5: 가이드 링크 텍스트에 우편/온라인/050-7457-5976 언급', async ({ page }) => {
    await goSignup(page);
    const guideDesc = page.locator('#guide-consent-desc');
    await expect(guideDesc).toContainText(/우편.*온라인|온라인.*우편/);
    await expect(guideDesc).toContainText(/050-7457-5976/);
  });
});
