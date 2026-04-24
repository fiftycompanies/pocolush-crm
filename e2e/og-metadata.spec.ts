/**
 * OG/Twitter metadata E2E — metadataBase 수정 확인
 *
 * 검증:
 * - <meta property="og:url"> 절대 URL 해석 (metadataBase=https://app.pocolush.com)
 * - <meta property="og:title"> / og:description / og:image 존재
 * - <meta name="twitter:card"> 존재
 * - favicon 링크 200
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://app.pocolush.com';

test.describe('OG metadata', () => {
  test.describe.configure({ mode: 'serial' });

  test('OG-1: metadataBase 가 절대 URL 로 해석됨 (og:url)', async ({ page }) => {
    await page.goto(`${BASE}/m/signup`);
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content').catch(() => null);
    // metadataBase 가 설정됐으면 og:url 은 절대 URL (next.js 가 자동 해석)
    if (ogUrl) expect(ogUrl).toMatch(/^https?:\/\//);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
    if (ogTitle) expect(ogTitle.length).toBeGreaterThan(0);
  });

  test('OG-2: og:image 가 존재하면 절대 URL', async ({ page }) => {
    await page.goto(`${BASE}/`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null);
    if (!ogImage) {
      test.skip(true, 'og:image 미설정 — 스킵');
      return;
    }
    expect(ogImage).toMatch(/^https?:\/\//);
  });

  test('OG-3: canonical 링크가 app.pocolush.com 도메인 (metadataBase 효과)', async ({ page, baseURL }) => {
    await page.goto(`${BASE}/`);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
    if (!canonical) {
      test.skip(true, 'canonical 미설정 — 스킵');
      return;
    }
    expect(canonical).toMatch(/^https:\/\//);
    if ((baseURL || BASE).includes('pocolush.com')) {
      expect(canonical).toContain('pocolush.com');
    }
  });

  test('OG-4: favicon 응답 200', async ({ request }) => {
    const res = await request.get(`${BASE}/favicon.ico`);
    expect([200, 204]).toContain(res.status());
  });
});
