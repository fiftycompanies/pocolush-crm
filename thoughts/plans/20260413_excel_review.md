# 엑셀 다운로드 플랜 검수 보고서

> 플랜: `thoughts/plans/20260413_inquiry_excel_download_plan.md`
> 검수일: 2026-04-13

---

## A. 8항목 기술 검수 (글자깨짐/파일깨짐 방지)

| # | 항목 | 판정 | 상세 |
|---|------|------|------|
| 1 | .xlsx 포맷 (CSV 금지) | ✅ 통과 | exceljs로 .xlsx 생성. CSV 경로 없음 |
| 2 | 서버사이드 생성 | ✅ 통과 | `app/api/export/route.ts` API Route에서 Node.js 실행 |
| 3 | Buffer → Response 직접 전달 | ✅ 통과 | `new Response(buffer)` 사용, NextResponse.json() 금지 명시 |
| 4 | 클라이언트 .blob() 수신 | ✅ 통과 | `response.blob()` 사용, `.text()` 금지 명시 |
| 5 | 한글 파일명 RFC 5987 | ✅ 통과 | `filename*=UTF-8''${encodeURIComponent()}` |
| 6 | 날짜 포맷 | ✅ 통과 | `YYYY-MM-DD HH:mm` 한국 형식 |
| 7 | 타입/상태 한글 라벨 변환 | ✅ 통과 | constants.ts의 INQUIRY_TYPES, INQUIRY_STATUS 등 매핑 |
| 8 | Content-Type 정확 | ✅ 통과 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

### 추가 발견 사항

| 항목 | 상태 | 권고 |
|------|------|------|
| 연락처 숫자 → 텍스트 처리 | ⚠️ 플랜에 미명시 | 전화번호(`010-1234-5678`)가 Excel에서 숫자로 해석되지 않도록 셀 타입을 **텍스트**로 강제해야 함. `{ type: 'string' }` 지정 필요 |
| 빈 데이터(0건) 시 처리 | ⚠️ 플랜에 미명시 | 필터 결과 0건일 때 빈 엑셀 생성 vs 에러 메시지 → **헤더만 있는 빈 엑셀 생성**이 적절 (toast로 "0건" 안내 추가) |
| JSONB `data` 필드 처리 | ⚠️ 플랜에 미명시 | 문의의 `data` 필드(JSONB)는 유형별 커스텀 데이터. 엑셀에 포함 여부 결정 필요 → **v1에서는 제외, 향후 확장** 권고 |
| 대용량 방어 | ✅ 문제없음 | CRM 특성상 수천 건 이하. exceljs 버퍼 방식 충분 |

---

## B. 7점 보안/품질 체크리스트

### 변경 유형: API/백엔드 + 프론트엔드 → 필수 항목: #1 #2 #3 #5 #6

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 인증/권한 | ⚠️ 주의 | 아래 상세 |
| 2 | 비정상 경로 | ⚠️ 주의 | 아래 상세 |
| 3 | 중복 요청/동시성 | ✅ 통과 | 읽기 전용 API, 부작용 없음 |
| 4 | DB 정합성 | ✅ 해당없음 | SELECT 쿼리만 사용, 쓰기 없음 |
| 5 | 비밀정보 노출 | ✅ 통과 | API 키/토큰 노출 경로 없음. 서버사이드 Supabase 클라이언트 사용 |
| 6 | 런타임 이슈 | ⚠️ 주의 | 아래 상세 |
| 7 | 배포 후 대응 | ✅ 통과 | Vercel Functions 로그로 추적 가능. 롤백: `vercel rollback` |

### ⚠️ 주의 항목 상세

#### #1 인증/권한 — API Route 인증 필수

**현재 미들웨어 분석**:
- `middleware.ts` → `updateSession()`: `/dashboard/*` 접근 시 Supabase 인증 확인
- **문제**: `/api/export` 경로는 미들웨어 matcher에 포함되지만, `updateSession()`은 **세션 갱신만 수행**하고 `/api/*` 경로에 대한 리다이렉트 로직이 없음
- 미들웨어는 `/dashboard`로 시작하는 경로만 미인증 시 `/login`으로 리다이렉트

**대응 필요**:
```
API Route 내부에서 반드시 인증 체크:
1. createClient() (서버용)
2. supabase.auth.getUser()
3. profiles 테이블에서 admin 확인
4. 미인증 또는 비어드민 → 401 반환
```
→ **플랜에 "세션 없으면 401" 명시되어 있으나, profiles 테이블 admin 확인까지 포함해야 함**

#### #2 비정상 경로

| 시나리오 | 현재 대응 | 권고 |
|---------|----------|------|
| Supabase 쿼리 실패 | 플랜 미명시 | try-catch + 500 에러 + 구체적 메시지 |
| exceljs writeBuffer 실패 | 플랜 미명시 | try-catch + 500 |
| 잘못된 target 파라미터 | 플랜 미명시 | 400 Bad Request + 유효 target 목록 반환 |
| 네트워크 실패 (클라이언트) | 플랜 미명시 | toast 에러 메시지 표시 |
| 매우 긴 search 파라미터 | 플랜 미명시 | search 길이 제한 (100자) |

#### #6 런타임 이슈

| 항목 | 상태 | 비고 |
|------|------|------|
| exceljs Node.js 호환 | ✅ | API Route는 Node.js 런타임 (Edge 아님) |
| Next.js 16 `cookies()` async | ✅ | `lib/supabase/server.ts`에 이미 `await cookies()` 적용 |
| exceljs ESM/CJS 호환 | ⚠️ | Next.js 16 + ESM에서 `import ExcelJS from 'exceljs'` 동작 확인 필요. `next.config.ts`에 `serverExternalPackages: ['exceljs']` 추가 권고 |

---

## C. 타 기능 영향 분석

### 영향 매트릭스

| 기존 기능 | 영향 여부 | 상세 |
|-----------|----------|------|
| 문의 CRUD | ❌ 없음 | 읽기 전용 API 추가, 기존 로직 미변경 |
| 고객 관리 | ❌ 없음 | 동일 |
| 임대 계약 | ❌ 없음 | 동일 |
| 농장 관리 | ❌ 없음 | 동일 |
| 회원 가입/승인 | ❌ 없음 | 동일 |
| 바베큐 예약 | ❌ 없음 | 동일 |
| 스토어 주문 | ❌ 없음 | 동일 |
| 쿠폰 발급 | ❌ 없음 | 동일 |
| 블로그/공지 | ❌ 없음 | 동일 |
| 인증 미들웨어 | ❌ 없음 | 미들웨어 변경 없음, API 내부에서 별도 인증 |
| 회원 앱 (/member) | ❌ 없음 | 어드민 전용 API, 회원 경로 무관 |
| 홈페이지 (www.pocolush.com) | ❌ 없음 | 별도 도메인, CRM과 무관 |
| Supabase RLS | ❌ 없음 | anon key + RLS 정책 범위 내 조회 |
| 푸시 알림 (FCM) | ❌ 없음 | 완전 무관 |
| SMS (aligo) | ❌ 없음 | 완전 무관 |

### 잠재적 위험 요소

| 위험 | 확률 | 영향 | 대응 |
|------|------|------|------|
| exceljs 번들이 Vercel 함수 크기 제한 초과 | 낮음 | 배포 실패 | exceljs ~1.2MB, Vercel 기본 50MB 제한 → 충분 |
| 동시 다수 다운로드 시 서버 부하 | 낮음 | 응답 지연 | CRM 사용자 2-3명, 문제 없음 |
| API Route 콜드스타트 | 낮음 | 첫 요청 2-3초 | Fluid Compute 활용, toast로 "생성 중" 안내 |
| 11개 target별 쿼리 하나에 버그 | 중간 | 특정 페이지만 실패 | target별 독립 try-catch, 에러 시 해당 target만 500 |

### 변경 격리 확인

```
신규 파일 (기존 코드와 완전 독립):
├── lib/excel.ts                    — 공통 유틸 (import만 받음)
├── app/api/export/route.ts         — 신규 API (기존 API 없음, 충돌 불가)
└── components/ui/ExportButton.tsx  — 신규 컴포넌트 (기존 컴포넌트 미변경)

수정 파일 (JSX 버튼 삽입만):
├── 11개 page.tsx — <ExportButton> 1줄 추가
└── 기존 로직 변경: 0줄
```

---

## D. 플랜 보완 권고사항

| # | 항목 | 우선도 | 설명 |
|---|------|--------|------|
| 1 | API Route admin 권한 체크 강화 | 🔴 필수 | `profiles` 테이블에서 admin 확인. getUser()만으로는 회원도 접근 가능 |
| 2 | 전화번호 셀 타입 텍스트 강제 | 🔴 필수 | Excel이 `010`을 `10`으로 바꾸는 문제 방지 |
| 3 | `serverExternalPackages` 설정 | 🟡 권고 | `next.config.ts`에 `['exceljs']` 추가로 번들링 이슈 방지 |
| 4 | 에러 핸들링 명시 | 🟡 권고 | 각 단계(인증/쿼리/생성)별 try-catch + 적절한 HTTP 상태 코드 |
| 5 | 0건 시 빈 엑셀 + toast | 🟢 선택 | 빈 결과도 헤더만 있는 엑셀 생성, "0건입니다" toast 표시 |
| 6 | JSONB data 필드 | 🟢 선택 | v1에서는 제외, v2에서 유형별 컬럼 확장 |

---

## E. 최종 판정

| 영역 | 판정 |
|------|------|
| 8항목 기술 검수 | ✅ **통과** (보완 2건 반영 시) |
| 7점 보안/품질 | ⚠️ **조건부 통과** — #1 admin 권한 체크 강화 필수 |
| 타 기능 영향 | ✅ **영향 없음** — 완전 격리된 추가 기능 |
| 구현 진행 가능 여부 | ✅ **가능** — 보완 권고 #1, #2 반영 후 구현 |
