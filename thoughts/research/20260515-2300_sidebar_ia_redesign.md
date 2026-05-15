# 어드민 사이드바 IA 재설계 — 리서치 (2026-05-15)

> **목적**: pocolush-crm `/dashboard/*` 사이드바의 그룹핑·간격·라벨을 4축(ux-heuristics + refactoring-ui + pm-toolkit + 유사 SaaS) 기준으로 재설계하기 위한 사실 근거 정리.
> **출처**: 코드 직접 인용 + Supabase MCP + Shopify Admin/Toss Place/Hotel PMS 공식 가이드.
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도 파일) 로 권고안 확정.

---

## 0. 한 줄 요약

> 현 사이드바는 **"회원 서비스" 그룹 1개에 10개 항목(7±2 초과) + 4개 도메인(회원/평상/상거래/공지) 혼재** + **그룹 간 간격 비대칭(separator+헤더 vs border-t)** + **2개 라벨이 16자 초과("평상 시설·운영시간", "평상 메뉴·이벤트")** 라는 3중 누적 부담을 가진다. Shopify Admin/Toss Place 패턴은 **운영 흐름(주문→상품→고객) 기반 그룹** + **균일 간격 토큰**을 공통으로 적용한다.

---

## 1. 현 Sidebar 코드 사실 (정밀 인용)

**파일**: `components/layout/Sidebar.tsx`

### 1-1. 그룹 정의

| 그룹 | 코드 라인 | 항목 수 | 항목 (label) |
|---|---|---|---|
| `mainNav` | 12–17 | 4 | 대시보드, 문의 관리, 농장 관리, 임대 계약 |
| `memberNav` | 19–30 | **10** | 회원 관리, 회원권 관리, 신청 관리, 평상 예약 현황, 평상 시설·운영시간, 평상 메뉴·이벤트, 스토어 설정, 플랜 관리, 쿠폰 설정, 공지 관리 |
| `contentNav` | 32–34 | 1 | 블로그 관리 |
| `bottomNavBase` | 36–40 | 3 | 감사 로그, 알림 설정, 설정 |
| `warningNav` | 42–44 | 1 | 경고 (admin only) |

### 1-2. 시각 분리 패턴

| 분리 위치 | Tailwind 클래스 | 실제 간격(px) |
|---|---|---|
| nav 메인 영역 wrapper | `flex-1 px-3 py-4 flex flex-col gap-1` | 항목 간 4px |
| mainNav ↔ memberNav | `mx-1 my-2 h-px bg-sidebar-border` (separator) + `mb-1` (헤더) | **separator 위 8 + 아래 8 + 헤더 아래 4 = 20** |
| memberNav ↔ contentNav | 동일 패턴 | **20** |
| contentNav ↔ bottomNav | `px-3 py-4 border-t border-sidebar-border` (별도 div) | **17** (border 1px + py-4 16) |

> **사용자 지적 "메뉴별 간격도 위 아래가 다르네"의 원인**:
> 그룹 간 간격이 **20px / 20px / 17px** 로 마지막만 비대칭. 또한 그룹 헤더 위(separator 4+4=8) ≠ 아래(`mb-1`=4) 도 비대칭.

### 1-3. 그룹 헤더 토큰

```
className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1"
```
- 색: 40% 투명 → 0% 톤. de-emphasized OK ✓
- 크기: 10px → refactoring-ui 권고 12–14px 보다 1단계 작음. uppercase 보정으로 가독은 유지

### 1-4. 메뉴 항목 토큰

```
"flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-all
 bg-sidebar-accent text-sidebar-accent-foreground font-semibold (active)
 text-sidebar-foreground/60 hover:bg-sidebar-accent (inactive)"
```
- 높이 h-9 = 36px (44pt 미달 — 모바일 터치 타깃 권고 위반, 단 어드민이라 데스크탑 우선)
- inactive 색 60% → 4.5:1 대비 만족 여부는 sidebar 토큰 값에 따라 다름 (별도 확인 필요)

---

## 2. 페이지 제목 vs 메뉴 라벨 일관성

(Explore 에이전트 raw 측정)

| 메뉴 라벨 | 페이지 h1 | 일치 |
|---|---|---|
| 대시보드 | (대시보드) | ✓ |
| 문의 관리 | 문의 관리 | ✓ |
| 농장 관리 | (컴포넌트 위임, 확인 불가) | ? |
| 임대 계약 | 임대 계약 | ✓ |
| 회원 관리 | 회원 관리 | ✓ |
| 회원권 관리 | (컴포넌트 위임) | ? |
| 신청 관리 | 신청 관리 | ✓ |
| 평상 예약 현황 | 평상 예약 현황 | ✓ |
| 평상 시설·운영시간 | **평상 설정** | ✗ (2026-05-15 워딩 fix) |
| 평상 메뉴·이벤트 | (컴포넌트 위임) | ? |
| 스토어 설정 | 스토어 설정 | ✓ |
| 플랜 관리 | 플랜 관리 | ✓ |
| 쿠폰 설정 | 쿠폰 설정 | ✓ |
| 공지 관리 | 공지 관리 | ✓ |
| 블로그 관리 | 블로그 관리 | ✓ |
| 알림 설정 | 알림 설정 | ✓ |
| 설정 | 설정 | ✓ |
| 경고 | **시스템 경고** | △ (메뉴 vs 제목 정도차) |

**결론**:
- "평상 시설·운영시간" 메뉴는 페이지 제목이 "평상 설정"으로 단순화 — 메뉴도 짧게 정렬할 명분 ✓
- "경고" 메뉴는 "시스템 경고" 와 차이 — 어드민 컨텍스트에서 "경고"만으로 충분, 또는 "시스템 경고"로 통일

---

## 3. DB 도메인 매핑 (사용자 가치 기반)

(Supabase MCP + migrations/ 카운트)

| 도메인 | 테이블 (대표) | 메뉴 매핑 | 사용 빈도 가설 |
|---|---|---|---|
| **회원 생명주기** | members, member_status_logs, member_notifications, memberships | 회원 관리, 회원권 관리, 신청 관리 | **매일** (60 approved + 신규 신청) |
| **농장 자원** | farms, farm_zones, farm_rentals | 농장 관리, 임대 계약 | **주 1–2회** (계약 갱신) |
| **평상(BBQ)** | bbq_facilities, bbq_time_slots, bbq_reservations, bbq_products | 평상 예약 현황, 평상 설정, 평상 메뉴 | **매일** (예약 보드 + 시설 점검) |
| **상거래** | store_products, service_orders, plans, coupons, coupon_issues | 스토어 설정, 플랜 관리, 쿠폰 설정 | **월 1–2회** (정책 변경) |
| **소통** | notices, posts, inquiries | 공지 관리, 블로그 관리, 문의 관리 | **주 1–2회** |
| **시스템/감사** | audit_logs, notifications, trigger_error_logs | 감사 로그, 알림 설정, 설정, 경고 | **이벤트 시** (PIPA, 장애) |

**관찰**: 현재 **"회원 서비스"** 단일 그룹이 위 6개 도메인 중 **3개(회원/평상/상거래) + 공지**를 모두 흡수 → IA 그룹 의미 손실.

---

## 4. 유사 SaaS IA 패턴 (공식 가이드)

### 4-1. Shopify Admin
> "Information architecture is the practice of organizing sections so that they make sense as a whole. **Use the fewest possible categories** to define what your app does. Make navigation items **short and scannable**, using **nouns** instead of verbs."
> — [Shopify App Design: Navigation](https://shopify.dev/docs/apps/design/navigation)

**상단(고정)**: Home → Orders → Products → Customers → Marketing → Discounts → Content → Analytics → Reports
**하단(고정)**: Settings (gear)
**그룹 라벨**: 없음 — 평면 단일 그룹에 9–10개, 단 **운영 흐름 순서** 강제 (들어오는 주문 → 진열 → 회원 → 마케팅 → 측정)

### 4-2. Toss Place (한국 SMB)
> "주문·결제·고객관리부터 배달·예약 연동, 키오스크 모드까지 한 번에" — [Toss Place](https://tossplace.com/)

**상단(매일)**: 매출 → 주문 → 정산
**중간(주 단위)**: 상품 → 고객 → 마케팅
**하단(이벤트)**: 사업 운영, 설정

**핵심 교훈**: **사용 빈도 내림차순 정렬** + **한국어 명사형** + **5±2 그룹**.

### 4-3. Hotel PMS (예: Mews, RoomMaster)
> "PMS connects all departments — front desk, reservations, housekeeping, billing, reporting."
> — [What is Hotel PMS](https://www.mews.com/en/blog/what-is-hotel-pms)

**그룹 패턴**:
1. **Operations** (Reservations / Check-in / Check-out / Today's board)
2. **Inventory** (Rooms / Rates / Availability)
3. **Guests** (Profiles / History / Loyalty)
4. **Finance** (Folios / Payments / Reports)
5. **System** (Users / Audit / Settings)

→ **부서/JTBD 기반 5개 그룹**. pocolush 도 농장+평상이 "Operations", 회원이 "Guests" 매핑 가능.

### 4-4. 공통 원칙 추출

| 원칙 | Shopify | Toss Place | Hotel PMS | pocolush 적용 |
|---|---|---|---|---|
| 그룹 수 | 평면(label 없음) | 3–4 그룹 | 5 그룹 | **5개 권고** |
| 항목 수/그룹 | 9–10 평면 | 3–4 | 3–6 | **3–5 권고** |
| 순서 기준 | 운영 흐름 | 사용 빈도 | JTBD | **운영 흐름 + 빈도 혼합** |
| 라벨 | 명사 단어 (Orders) | 명사 (매출) | 명사 (Reservations) | **명사 + 8자 이내** |
| 하단 고정 | Settings | 설정 | Users/Audit/Settings | **시스템/설정** |

---

## 5. ux-heuristics 적용 진단

| Nielsen 휴리스틱 | 현 사이드바 | 점수 | 비고 |
|---|---|---|---|
| #2 매칭 | "회원 서비스"가 평상/상거래/공지 포함 → mental model 불일치 | 4/10 | 그룹 라벨이 내용을 잘못 약속 |
| #4 일관성 | "·" 구분자 vs 공백 vs 띄어쓰기 일관 X. 일부 "관리" vs "설정" 혼용 | 6/10 | 라벨 동사 통일 권고 |
| #6 인식 > 회상 | 아이콘+텍스트 ✓, 그룹 헤더 작아서 인지 약함 | 7/10 | 헤더 12px+간격 강화 |
| #8 미니멀 | 10개 항목 단일 그룹 = 시각 잡음 | 5/10 | 분할 필요 |

**Krug**:
- "Don't make me think" 위반: "평상 시설·운영시간" — 두 개념을 `·`로 묶음 → 16자, 메뉴에서 줄바꿈 위험
- 트렁크 테스트: 신규 운영자가 "쿠폰 신규 등록"을 위해 "회원 서비스 → 쿠폰 설정" 경로를 추론 불가

---

## 6. refactoring-ui 적용 진단 (간격·위계)

| 원칙 | 현 코드 | 권고 |
|---|---|---|
| 4pt grid | 4/8/16/24 혼재 (mb-1=4, my-2=8, py-4=16) ✓ | 유지 |
| 그룹 외 > 그룹 내 | 그룹 외 20px (separator 패턴) vs 17px (border-t) — **비대칭** | **24px 통일** |
| 헤더 위/아래 | 위 8 / 아래 4 — 비대칭 | **위 16 / 아래 8** (그룹 정체성 강화) |
| 라벨 < 값 | 헤더 10px uppercase OK ✓ | 11–12px 로 1단계 상향 (가독성) |
| 메뉴 높이 | h-9 = 36px | 데스크탑 유지, 모바일(U2) 만 h-11(44px) 권고 |

---

## 7. PM JTBD 기반 우선순위 (사용 빈도 가설)

> **JTBD**: "운영자(admin)는 [매일 들어오는 평상/농장 예약 신청과 회원 활동을 빠르게 처리]하기 위해 [어드민에 로그인]한다."

| 빈도 | 메뉴 | JTBD |
|---|---|---|
| **매일** | 대시보드, 문의 관리, 신청 관리, 평상 예약 현황 | 오늘 들어온 거 확인 |
| **주 단위** | 회원 관리, 회원권 관리, 농장 관리, 임대 계약, 공지 관리 | 주간 운영 |
| **월 단위** | 평상 설정(시설), 평상 메뉴, 스토어 설정, 플랜 관리, 쿠폰 설정, 블로그 관리 | 정책·콘텐츠 갱신 |
| **이벤트** | 경고, 감사 로그, 알림 설정, 설정 | 장애·점검 |

**RICE 인공 (re-design 후보)**:
- Reach: admin 1명 (작음) — 모든 항목 동일 가중
- Impact: 인지 부담 감소 = 매일 사용 항목에 큰 영향
- Confidence: high (외부 패턴 + 휴리스틱 일치)
- Effort: S (Sidebar.tsx + DashboardShell 일부 + storybook 없음)

→ **RICE Score = 4 × 3 × 0.9 / 2 = 5.4 (Quick Win)**

---

## 8. 권고 IA 가설 (3안)

### 안 A — JTBD/빈도 기반 (4개 그룹, 권고)

```
[일별 운영]          매일 1회+
  대시보드
  신청 관리
  평상 예약 현황
  문의 관리

[회원]               회원 라이프사이클
  회원 관리
  회원권 관리
  공지 관리

[자원/시설]          운영 자산
  농장 관리
  임대 계약
  평상 설정
  평상 메뉴

[상거래]             결제·상품
  스토어 설정
  플랜 관리
  쿠폰 설정

[콘텐츠]
  블로그 관리

[시스템] (하단)
  경고 (admin)
  감사 로그
  알림 설정
  설정
```
- 그룹 6개 (콘텐츠는 1개라 단독), 평균 항목 3.5개 ✓ 7±2
- 빈도 내림차순 ✓
- "회원" 그룹에 "공지"가 포함 — 회원 대상 메시지라 자연스러움

### 안 B — 도메인(DB 스키마) 기반 (5개 그룹)

```
[홈]   대시보드
[회원] 회원 / 회원권 / 신청
[농장] 농장 / 임대
[평상] 예약 현황 / 시설 / 메뉴
[상거래] 스토어 / 플랜 / 쿠폰
[소통] 공지 / 블로그 / 문의
[시스템] (하단) 경고 / 감사 / 알림 / 설정
```
- DB 도메인 = UI 그룹 1:1 매핑 — 개발/QA 친숙도 높음
- 단점: "신청 관리"가 회원 그룹인데 실제 처리는 평상+농장 도메인 혼재 → 발견성 낮음

### 안 C — Shopify-style 평면 + 우선순위 정렬

```
대시보드
신청 관리
평상 예약 현황
회원 관리
회원권 관리
공지 관리
문의 관리
농장 관리
임대 계약
평상 설정
평상 메뉴
스토어 설정
플랜 관리
쿠폰 설정
블로그 관리
[시스템] (하단) ...
```
- 그룹 라벨 0, 빈도 순 단일 리스트 — 단순함 최대
- 단점: 15개 평면 항목 = Miller 위반, 스캔 비용 큼

**권고**: **안 A (JTBD/빈도 기반)** — 그룹 의미 명확 + 7±2 충족 + 평상이 별도 그룹으로 발견성 ↑.

---

## 9. 간격 시스템 재정의

| 토큰 | 현재 | 권고 |
|---|---|---|
| 항목 간 (그룹 내) | `gap-1` = 4 | **`gap-0.5` = 2** 또는 유지 (소형 메뉴 밀도) |
| 그룹 위 간격 | separator `my-2` = 8+8 | **`mt-6` = 24 (헤더 위만)** — separator 제거 |
| 그룹 헤더 아래 | `mb-1` = 4 | **`mb-2` = 8** |
| 첫 그룹 (mainNav) 위 padding | `py-4` = 16 | 유지 |
| 하단 영역 분리 | `border-t` + `py-4` | **`mt-6` + `border-t` + `pt-4`** (위 24, 아래 16 통일) |
| 그룹 헤더 폰트 | `text-[10px]` | **`text-xs` = 12** (가독 +) |

**결과**: 모든 그룹 간 간격 = **24px** 통일, 헤더 위/아래 = **24 / 8** 일관.

---

## 10. 라벨 단축 권고

| 현 라벨 | 글자수 | 권고 | 글자수 | 사유 |
|---|---|---|---|---|
| 평상 시설·운영시간 | 9 | **평상 설정** | 5 | 페이지 h1 일치 |
| 평상 메뉴·이벤트 | 8 | **평상 메뉴** | 4 | 이벤트는 페이지 내부 탭 |
| 회원권 관리 | 5 | 유지 | 5 | OK |
| 평상 예약 현황 | 7 | 유지 | 7 | "예약 보드" 도 가능 (선택) |
| 알림 설정 | 4 | 유지 | 4 | OK |
| 시스템 경고 ↔ 경고 | 5/2 | **시스템 경고** | 5 | 메뉴=페이지 일치 |

---

## 11. 아이콘 검토

현재 lucide-react 24개 import. 변경 권고:
- 동일 아이콘 중복 없음 ✓
- "평상 예약 현황" `LayoutGrid`, "평상 시설" `Settings2`, "평상 메뉴" `Package` — 일관성 보강 위해 평상 그룹은 **모두 `Tent` 또는 `Utensils` 계열**로 통일 검토 (선택)

---

## 12. 리스크 / 회귀 우려

| 리스크 | 가능성 | 대응 |
|---|---|---|
| ALL_NAV_HREFS active 매칭 깨짐 | 중 | 메뉴 배열 분할 시 통합 변수 보존 (line 47-49 패턴 유지) |
| Sidebar.tsx 의 mobile V2 prop 영향 | 낮 | mobileEnabled/mobileOpen/onLinkClick 그대로 전달 |
| E2E "사이드바 평상 메뉴 3개" 라벨 변경 → spec 깨짐 | 확실 | `e2e/qa-prod-validation.spec.ts:135-145` "평상 시설·운영시간" → "평상 설정" 동시 갱신 필요 |
| 페이지 h1 미일치 잔존 (e.g. "농장 관리"/"회원권 관리") | 낮 | 별도 hotfix 후속 |

---

## 13. 비고: 본 리서치는 plan.md 의 사실 근거이며, **kk 승인 전 구현 금지** (CLAUDE.md 통합 워크플로 규칙).

---

## 출처

- [Shopify App Design: Navigation](https://shopify.dev/docs/apps/design/navigation)
- [Shopify Help: Navigating the admin](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview)
- [Toss Place 공식](https://tossplace.com/) / [Toss Place POS](https://tossplace.com/product/pos)
- [Mews: What is hotel PMS](https://www.mews.com/en/blog/what-is-hotel-pms)
- [RoomMaster: Hotel PMS Features](https://www.roommaster.com/blog/what-is-hotel-pms-system)
- Nielsen Norman Group: 10 Usability Heuristics
- Krug: Don't Make Me Think (3판) — Trunk Test
- Wathan/Schoger: Refactoring UI — Spacing & Sizing 챕터
- 사내 인계인수서: `thoughts/sessions/20260515-2200_handover.md`
- 사내 백로그 플랜: `thoughts/plans/20260515-2000_backlog_safe_rollout_plan.md` (F1 사이드바 그룹화 P3 항목)
