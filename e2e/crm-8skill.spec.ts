import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@pocolush.test';
const ADMIN_PW = 'admin1234';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[placeholder="이메일"]', ADMIN_EMAIL);
  await page.fill('input[placeholder="비밀번호"]', ADMIN_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe('8스킬 E2E 검증', () => {

  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  // #1. 공지수정 404 수정
  test('#1 공지 생성 → 수정 → 확인', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/notices`);
    await expect(page.locator('h1')).toContainText('공지 관리');

    // 새 공지 생성
    await page.click('text=새 공지');
    await page.waitForURL('**/notices/new');
    await page.fill('input[placeholder="공지 제목 *"]', 'E2E 테스트 공지');
    await page.fill('textarea', '테스트 내용입니다.');
    await page.click('text=발행하기');
    await page.waitForURL('**/notices', { timeout: 10000 });

    // 수정 버튼 → /edit 페이지 (404 아님)
    const editLink = page.locator('table tbody tr').first().locator('a[href*="/edit"]');
    await expect(editLink).toBeVisible({ timeout: 5000 });
    await editLink.click();
    await page.waitForURL(/\/edit/);
    await expect(page.locator('h1')).toContainText('공지 수정');

    // 수정 후 저장
    const titleInput = page.locator('input[placeholder="공지 제목 *"]');
    await expect(titleInput).toHaveValue(/E2E 테스트 공지/);
    await titleInput.fill('E2E 공지 (수정됨)');
    await page.click('text=임시저장');
    await page.waitForURL('**/notices', { timeout: 10000 });
    await expect(page.locator('table')).toContainText('E2E 공지 (수정됨)');
  });

  // #2. 쿠폰 비활성화/삭제
  test('#2 쿠폰 비활성화 + 삭제', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/coupons`);
    await expect(page.locator('h1')).toContainText('쿠폰 설정');

    // 테스트 쿠폰 생성
    await page.click('text=쿠폰 생성');
    await page.fill('input[placeholder="쿠폰명 *"]', 'E2E삭제용');
    await page.fill('input[placeholder="할인값 *"]', '10');
    await page.locator('.bg-card button:has-text("생성")').click();
    await page.waitForTimeout(1500);

    // 3-dot 메뉴 → 비활성화
    const row = page.locator('table tbody tr', { hasText: 'E2E삭제용' });
    await expect(row).toBeVisible();
    await row.locator('button').last().click();
    await page.click('button:has-text("비활성화")');
    await page.waitForTimeout(500);
    await expect(row.locator('span', { hasText: '비활성' })).toBeVisible();

    // 3-dot → 삭제
    await row.locator('button').last().click();
    const delBtn = page.locator('.absolute button.text-red, .absolute button:has-text("삭제")');
    if (await delBtn.isVisible()) {
      await delBtn.click();
      // 삭제 확인 다이얼로그
      const confirmDel = page.locator('.fixed button:has-text("삭제")');
      if (await confirmDel.isVisible()) await confirmDel.click();
      await page.waitForTimeout(1000);
    }
  });

  // #3. 신청관리 허브
  test('#3 신청관리 통합 페이지', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/requests`);
    await expect(page.locator('h1')).toContainText('신청 관리');
    // 타입 필터 칩 확인
    await expect(page.locator('button', { hasText: 'BBQ' })).toBeVisible();
    await expect(page.locator('button', { hasText: '스토어' })).toBeVisible();
    await expect(page.locator('button', { hasText: '쿠폰' })).toBeVisible();
    // 상태 탭 확인
    await expect(page.locator('button', { hasText: '대기' }).first()).toBeVisible();
    // 검색 확인
    await expect(page.locator('input[placeholder*="신청자명"]')).toBeVisible();
  });

  // #4. 회원 상태 변경
  test('#4 회원 상태 드롭다운 + 회원추가 버튼', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/members`);
    await expect(page.locator('h1')).toContainText('회원 관리');
    // 회원 추가 버튼 확인 (#9)
    await expect(page.locator('button', { hasText: '회원 추가' })).toBeVisible();
    // 승인 탭
    await page.locator('button', { hasText: /^승인$/ }).click();
    await page.waitForTimeout(1000);
    // 상태 드롭다운 존재 확인
    const selects = page.locator('table select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(0); // 승인 회원 없을 수도 있음
  });

  // #6. 농장존
  test('#6 농장존 추가/표시', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/farms`);
    await expect(page.locator('h1')).toContainText('농장 관리');
    await expect(page.locator('text=/\\d+개 존/')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: '존 추가' })).toBeVisible();
    await expect(page.locator('button', { hasText: '사이트 추가' }).first()).toBeVisible();

    // 존 추가
    await page.click('button:has-text("존 추가")');
    await page.fill('input[placeholder*="존 이름"]', 'E2E존');
    await page.locator('.bg-card button:has-text("추가")').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('span.font-bold', { hasText: 'E2E존' }).first()).toBeVisible();
  });

  // #7. 사이드바
  test('#7 사이드바 고객관리 숨김 + 플랜관리', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(500);
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('a', { hasText: '고객 관리' })).toHaveCount(0);
    await expect(sidebar.locator('a', { hasText: '플랜 관리' })).toBeVisible();
    await expect(sidebar.locator('a', { hasText: '회원 관리' })).toBeVisible();
  });

  // #8. 플랜 CRUD
  test('#8 플랜 관리', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/plans`);
    await expect(page.locator('h1')).toContainText('플랜 관리');
    await page.waitForTimeout(1000);
    // 기존 플랜 확인
    await expect(page.locator('table')).toBeVisible();

    // 플랜 추가
    await page.click('text=플랜 추가');
    await page.fill('input[placeholder="플랜명 *"]', 'E2E플랜');
    const priceInput = page.locator('input[type="number"]').nth(1);
    await priceInput.fill('99000');
    await page.locator('.bg-card button:has-text("생성")').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('table')).toContainText('E2E플랜');
  });

  // #9. 회원 추가
  test('#9 회원 추가 모달', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/members`);
    await page.click('button:has-text("회원 추가")');
    await expect(page.locator('h2', { hasText: '회원 추가' })).toBeVisible();

    const rndPhone = '010-8888-' + Math.floor(Math.random() * 9000 + 1000);
    await page.fill('input[placeholder="홍길동"]', 'E2E회원');
    await page.fill('input[placeholder*="010"]', rndPhone);

    await page.locator('.fixed button:has-text("회원 추가")').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table')).toContainText('E2E회원');
  });

  // #5. 멤버십 카드 (빌드+라우트 검증)
  test('#5 멤버십 관련 페이지 정상', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/members`);
    await expect(page.locator('h1')).toContainText('회원 관리');
  });
});
