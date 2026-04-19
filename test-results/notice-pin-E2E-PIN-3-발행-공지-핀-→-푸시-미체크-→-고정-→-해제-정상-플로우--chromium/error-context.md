# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notice-pin.spec.ts >> E2E-PIN-3: 발행 공지 핀 → 푸시 미체크 → 고정 → 해제 (정상 플로우)
- Location: e2e/notice-pin.spec.ts:76:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/^고정됨$/').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=/^고정됨$/').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "P POCOLUSH CRM" [ref=e5] [cursor=pointer]:
        - /url: /dashboard
        - generic [ref=e7]: P
        - generic [ref=e8]: POCOLUSH CRM
      - navigation [ref=e10]:
        - link "대시보드" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e12]
          - generic [ref=e17]: 대시보드
        - link "문의 관리" [ref=e18] [cursor=pointer]:
          - /url: /dashboard/inquiries
          - img [ref=e19]
          - generic [ref=e21]: 문의 관리
        - link "농장 관리" [ref=e22] [cursor=pointer]:
          - /url: /dashboard/farms
          - img [ref=e23]
          - generic [ref=e25]: 농장 관리
        - link "임대 계약" [ref=e26] [cursor=pointer]:
          - /url: /dashboard/rentals
          - img [ref=e27]
          - generic [ref=e30]: 임대 계약
        - paragraph [ref=e32]: 회원 서비스
        - link "회원 관리" [ref=e33] [cursor=pointer]:
          - /url: /dashboard/members
          - img [ref=e34]
          - generic [ref=e38]: 회원 관리
        - link "회원권 관리" [ref=e39] [cursor=pointer]:
          - /url: /dashboard/memberships
          - img [ref=e40]
          - generic [ref=e43]: 회원권 관리
        - link "신청 관리" [ref=e44] [cursor=pointer]:
          - /url: /dashboard/requests
          - img [ref=e45]
          - generic [ref=e48]: 신청 관리
        - link "바베큐 설정" [ref=e49] [cursor=pointer]:
          - /url: /dashboard/bbq
          - img [ref=e50]
          - generic [ref=e52]: 바베큐 설정
        - link "바베큐 상품" [ref=e53] [cursor=pointer]:
          - /url: /dashboard/bbq-products
          - img [ref=e54]
          - generic [ref=e56]: 바베큐 상품
        - link "스토어 설정" [ref=e57] [cursor=pointer]:
          - /url: /dashboard/store
          - img [ref=e58]
          - generic [ref=e61]: 스토어 설정
        - link "플랜 관리" [ref=e62] [cursor=pointer]:
          - /url: /dashboard/plans
          - img [ref=e63]
          - generic [ref=e65]: 플랜 관리
        - link "쿠폰 설정" [ref=e66] [cursor=pointer]:
          - /url: /dashboard/coupons
          - img [ref=e67]
          - generic [ref=e69]: 쿠폰 설정
        - link "공지 관리" [ref=e70] [cursor=pointer]:
          - /url: /dashboard/notices
          - img [ref=e71]
          - generic [ref=e74]: 공지 관리
        - paragraph [ref=e76]: 콘텐츠
        - link "블로그 관리" [ref=e77] [cursor=pointer]:
          - /url: /dashboard/blog
          - img [ref=e78]
          - generic [ref=e82]: 블로그 관리
      - generic [ref=e83]:
        - link "경고" [ref=e84] [cursor=pointer]:
          - /url: /dashboard/warning
          - img [ref=e85]
          - generic [ref=e87]: 경고
        - link "감사 로그" [ref=e88] [cursor=pointer]:
          - /url: /dashboard/audit-logs
          - img [ref=e89]
          - generic [ref=e93]: 감사 로그
        - link "알림 설정" [ref=e94] [cursor=pointer]:
          - /url: /dashboard/notifications
          - img [ref=e95]
          - generic [ref=e98]: 알림 설정
        - link "설정" [ref=e99] [cursor=pointer]:
          - /url: /dashboard/settings
          - img [ref=e100]
          - generic [ref=e103]: 설정
    - generic [ref=e104]:
      - banner [ref=e105]:
        - generic [ref=e107]:
          - button "10" [ref=e109]:
            - img [ref=e110]
            - generic [ref=e113]: "10"
          - generic [ref=e115]:
            - generic [ref=e116]: 관
            - generic [ref=e117]: 관리자(co.kr)
            - button "로그아웃" [ref=e118]:
              - img [ref=e119]
      - main [ref=e122]:
        - generic [ref=e123]:
          - generic [ref=e124]:
            - generic [ref=e125]:
              - heading "공지 관리" [level=1] [ref=e126]
              - paragraph [ref=e127]: 전체 4건
            - generic [ref=e128]:
              - button "엑셀" [ref=e130] [cursor=pointer]:
                - img [ref=e131]
                - text: 엑셀
              - link "새 공지" [ref=e134] [cursor=pointer]:
                - /url: /dashboard/notices/new
                - img [ref=e135]
                - text: 새 공지
          - table [ref=e138]:
            - rowgroup [ref=e139]:
              - row "제목 카테고리 상태 작성일 액션" [ref=e140]:
                - columnheader "제목" [ref=e141]
                - columnheader "카테고리" [ref=e142]
                - columnheader "상태" [ref=e143]
                - columnheader "작성일" [ref=e144]
                - columnheader "액션" [ref=e145]
            - rowgroup [ref=e146]:
              - row "🛒 자람터 스토어 이용 방법 안내 🛒 안내 발행 2026. 4. 18. 고정하기" [ref=e147]:
                - cell "🛒 자람터 스토어 이용 방법 안내 🛒" [ref=e148]
                - cell "안내" [ref=e149]
                - cell "발행" [ref=e150]
                - cell "2026. 4. 18." [ref=e151]
                - cell "고정하기" [ref=e152]:
                  - generic [ref=e153]:
                    - button "고정하기" [ref=e154]:
                      - img [ref=e155]
                    - button "발행 취소" [ref=e157]:
                      - img [ref=e158]
                    - link [ref=e163] [cursor=pointer]:
                      - /url: /dashboard/notices/6dd79e47-fd47-4fc2-a9f1-2f4fbb1843db/edit
                      - img [ref=e164]
                    - button [ref=e166]:
                      - img [ref=e167]
              - row "🏊 포코러쉬 풀빌라 할인 쿠폰 사용 안내 🏊 안내 발행 2026. 4. 18. 고정하기" [ref=e170]:
                - cell "🏊 포코러쉬 풀빌라 할인 쿠폰 사용 안내 🏊" [ref=e171]
                - cell "안내" [ref=e172]
                - cell "발행" [ref=e173]
                - cell "2026. 4. 18." [ref=e174]
                - cell "고정하기" [ref=e175]:
                  - generic [ref=e176]:
                    - button "고정하기" [ref=e177]:
                      - img [ref=e178]
                    - button "발행 취소" [ref=e180]:
                      - img [ref=e181]
                    - link [ref=e186] [cursor=pointer]:
                      - /url: /dashboard/notices/55dd2150-4aaf-4a0b-bd95-d57821d1c5b5/edit
                      - img [ref=e187]
                    - button [ref=e189]:
                      - img [ref=e190]
              - row "🔥 바베큐존 오픈 감사 이벤트! 🔥 이벤트 발행 2026. 4. 18. 고정하기" [ref=e193]:
                - cell "🔥 바베큐존 오픈 감사 이벤트! 🔥" [ref=e194]
                - cell "이벤트" [ref=e195]
                - cell "발행" [ref=e196]
                - cell "2026. 4. 18." [ref=e197]
                - cell "고정하기" [ref=e198]:
                  - generic [ref=e199]:
                    - button "고정하기" [ref=e200]:
                      - img [ref=e201]
                    - button "발행 취소" [ref=e203]:
                      - img [ref=e204]
                    - link [ref=e209] [cursor=pointer]:
                      - /url: /dashboard/notices/78c72fe3-2980-469e-bbed-3d112d18c899/edit
                      - img [ref=e210]
                    - button [ref=e212]:
                      - img [ref=e213]
              - row "🌿 자람터 가족이 되신 것을 진심으로 환영합니다! 🎉 공지 발행 2026. 4. 14. 고정하기" [ref=e216]:
                - cell "🌿 자람터 가족이 되신 것을 진심으로 환영합니다! 🎉" [ref=e217]
                - cell "공지" [ref=e218]
                - cell "발행" [ref=e219]
                - cell "2026. 4. 14." [ref=e220]
                - cell "고정하기" [ref=e221]:
                  - generic [ref=e222]:
                    - button "고정하기" [ref=e223]:
                      - img [ref=e224]
                    - button "발행 취소" [ref=e226]:
                      - img [ref=e227]
                    - link [ref=e232] [cursor=pointer]:
                      - /url: /dashboard/notices/8ac26939-c304-4dfd-9464-499c7e0de9b7/edit
                      - img [ref=e233]
                    - button [ref=e235]:
                      - img [ref=e236]
  - status [ref=e244]: 공지를 찾을 수 없습니다.
  - alert [ref=e245]
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | const BASE = 'https://app.pocolush.com';
  4   | const ADMIN_EMAIL = 'admin@pocolush.co.kr';
  5   | const ADMIN_PW = '123456';
  6   | 
  7   | test.describe.configure({ mode: 'serial' });
  8   | 
  9   | async function login(page: Page) {
  10  |   await page.goto(`${BASE}/login`);
  11  |   await page.fill('input[type=email], input[placeholder="이메일"]', ADMIN_EMAIL);
  12  |   await page.fill('input[type=password], input[placeholder="비밀번호"]', ADMIN_PW);
  13  |   await Promise.all([
  14  |     page.waitForURL(/\/dashboard/, { timeout: 15000 }),
  15  |     page.click('button[type=submit]'),
  16  |   ]);
  17  | }
  18  | 
  19  | test('E2E-PIN-1: 어드민 공지 목록 페이지 렌더 + 액션 버튼', async ({ page }) => {
  20  |   await login(page);
  21  |   await page.goto(`${BASE}/dashboard/notices`);
  22  |   await page.waitForLoadState('networkidle');
  23  | 
  24  |   await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
  25  |   await expect(page.locator('p', { hasText: /전체 \d+건/ })).toBeVisible();
  26  |   await expect(page.getByRole('link', { name: /새 공지/ })).toBeVisible();
  27  | 
  28  |   // 핀 버튼 — 배포 전/후 호환 regex
  29  |   const pinButton = page.getByRole('button', { name: /^고정하?기?$/ }).first();
  30  |   await expect(pinButton).toBeVisible();
  31  | 
  32  |   await page.screenshot({ path: '/tmp/pin-e2e-01-list.png', fullPage: true });
  33  | });
  34  | 
  35  | test('E2E-PIN-2: 발행 공지 핀 → 모달 a11y (체크박스 기본 off + ESC 닫기)', async ({ page }) => {
  36  |   await login(page);
  37  |   await page.goto(`${BASE}/dashboard/notices`);
  38  |   await page.waitForLoadState('networkidle');
  39  | 
  40  |   // 첫 번째 핀 버튼 클릭 (일반 섹션의 첫 공지 = 미고정)
  41  |   const firstPinButton = page.getByRole('button', { name: /^고정하?기?$/ }).first();
  42  |   await firstPinButton.click();
  43  | 
  44  |   // 발행 공지면 모달이 뜸
  45  |   const modal = page.locator('[role=dialog]');
  46  |   const hasModal = await modal.isVisible().catch(() => false);
  47  | 
  48  |   if (hasModal) {
  49  |     // a11y 속성 확인
  50  |     await expect(modal).toHaveAttribute('aria-modal', 'true');
  51  |     const labelledby = await modal.getAttribute('aria-labelledby');
  52  |     expect(labelledby).toBeTruthy();
  53  | 
  54  |     // 체크박스 기본 unchecked
  55  |     const pushCheck = modal.locator('input[type=checkbox]');
  56  |     await expect(pushCheck).not.toBeChecked();
  57  | 
  58  |     await page.screenshot({ path: '/tmp/pin-e2e-02-modal.png' });
  59  | 
  60  |     // ESC로 닫기
  61  |     await page.keyboard.press('Escape');
  62  |     await expect(modal).not.toBeVisible({ timeout: 3000 });
  63  |   } else {
  64  |     // 미발행이면 모달 없이 바로 고정됨 — 토스트 확인
  65  |     await expect(page.locator('text=/고정됨/').first()).toBeVisible({ timeout: 5000 });
  66  |     await page.screenshot({ path: '/tmp/pin-e2e-02-toast.png', fullPage: true });
  67  |     // 원복
  68  |     const unpin = page.getByRole('button', { name: /고정 해제/ }).first();
  69  |     if (await unpin.isVisible().catch(() => false)) {
  70  |       await unpin.click();
  71  |       await page.waitForTimeout(1000);
  72  |     }
  73  |   }
  74  | });
  75  | 
  76  | test('E2E-PIN-3: 발행 공지 핀 → 푸시 미체크 → 고정 → 해제 (정상 플로우)', async ({ page }) => {
  77  |   await login(page);
  78  |   await page.goto(`${BASE}/dashboard/notices`);
  79  |   await page.waitForLoadState('networkidle');
  80  | 
  81  |   const initialPinnedSection = page.locator('text=/고정 공지 \\(/');
  82  |   const initialHasPinned = await initialPinnedSection.isVisible().catch(() => false);
  83  | 
  84  |   // 첫 번째 핀 버튼 클릭
  85  |   await page.getByRole('button', { name: /^고정하?기?$/ }).first().click();
  86  | 
  87  |   const modal = page.locator('[role=dialog]');
  88  |   if (await modal.isVisible().catch(() => false)) {
  89  |     // 체크박스 미체크 상태 유지 + "고정하기" 버튼
  90  |     await modal.getByRole('button', { name: '고정하기' }).click();
  91  |   }
  92  | 
  93  |   // 고정됨 토스트 (푸시 발송됨은 X)
> 94  |   await expect(page.locator('text=/^고정됨$/').first()).toBeVisible({ timeout: 5000 });
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  95  | 
  96  |   // 고정 섹션 나타남
  97  |   await expect(page.locator('text=/고정 공지 \\(/').first()).toBeVisible({ timeout: 3000 });
  98  | 
  99  |   await page.screenshot({ path: '/tmp/pin-e2e-03-pinned.png', fullPage: true });
  100 | 
  101 |   // 해제: 고정 섹션의 첫 행에서 "고정 해제" 버튼 클릭
  102 |   const unpinButton = page.getByRole('button', { name: /고정 해제/ }).first();
  103 |   await unpinButton.click();
  104 | 
  105 |   await expect(page.locator('text=/고정 해제됨/').first()).toBeVisible({ timeout: 5000 });
  106 | 
  107 |   // 원래 상태 복원 (고정 섹션 여전히 있다면 initialHasPinned가 true였음)
  108 |   if (!initialHasPinned) {
  109 |     await expect(page.locator('text=/고정 공지 \\(/').first()).not.toBeVisible({ timeout: 3000 });
  110 |   }
  111 | });
  112 | 
  113 | test('E2E-PIN-4: 키보드 드래그 센서 — 고정 섹션 존재 시 GripVertical 핸들 확인', async ({ page }) => {
  114 |   await login(page);
  115 |   await page.goto(`${BASE}/dashboard/notices`);
  116 |   await page.waitForLoadState('networkidle');
  117 | 
  118 |   const pinnedSection = page.locator('text=/고정 공지 \\(/');
  119 |   if (!(await pinnedSection.isVisible().catch(() => false))) {
  120 |     test.skip(true, '현재 고정 공지 없음 — 드래그 테스트 생략');
  121 |     return;
  122 |   }
  123 | 
  124 |   // GripVertical 핸들 버튼 (aria-label="순서 변경 핸들")
  125 |   const handle = page.getByRole('button', { name: /순서 변경 핸들/ }).first();
  126 |   await expect(handle).toBeVisible();
  127 | 
  128 |   // 키보드 힌트 문구 노출 확인
  129 |   await expect(page.locator('text=/Space.*↑↓.*Space/')).toBeVisible();
  130 | });
  131 | 
  132 | test('E2E-PIN-5: 10건 초과 경고 로직 — 임계값 코드 존재 확인 (실제 10건 생성 X)', async ({ page }) => {
  133 |   await login(page);
  134 |   await page.goto(`${BASE}/dashboard/notices`);
  135 |   await page.waitForLoadState('networkidle');
  136 | 
  137 |   // 고정 N/M 뱃지 포맷 ("고정 N건") 또는 경고 문구 소재 확인
  138 |   const pinBadge = page.locator('span', { hasText: /고정 \d+건/ });
  139 |   const count = await pinBadge.count();
  140 |   if (count > 0) {
  141 |     const text = await pinBadge.first().innerText();
  142 |     console.log(`현재 고정 뱃지: ${text}`);
  143 |   }
  144 |   // 단순히 페이지가 정상 로드되고 깨지지 않는지만 확인
  145 |   await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
  146 | });
  147 | 
```