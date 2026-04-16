# 자동 리포트 시스템 구현 플랜

> **⚠️ DEPRECATED (2026-04-16 20:00)** — kk 피드백으로 "외부 알림 없이 페이지 UI만, 매월+수동 갱신"으로 범위 축소.
> 최신 플랜: `20260416-2000_auto_reporting_plan_v2.md`

**작성일**: 2026-04-16
**리서치**: `thoughts/research/20260416-1830_auto_reporting_research.md`
**승인 상태**: DEPRECATED (kk 피드백으로 v2로 재설계)
**범위**: 옵션 B + C — **일일 이메일 요약 + 대시보드 Bell 배지 + 진단 페이지**

---

## 0. 결정 사항 요약

| 항목 | 선택 |
|------|------|
| 아키텍처 | 2계층 (일일 이메일 + 대시보드) |
| 이메일 공급자 | **Resend** (Vercel Marketplace 네이티브, 무료 3000건/월) |
| 스케줄러 | **Vercel Cron** (`vercel.json` 관리, Hobby 무료) |
| 즉시 알림 (옵션 D) | 현재 제외 — 필요 시 Phase 2 |
| Slack | 현재 제외 — 관리자 Slack 없으면 이메일만 |

---

## 1. 구현 단계 (Phase 1-A ~ 1-D)

### Phase 1-A: DB 준비 (migration 021)

**파일**: `supabase/migrations/021_trigger_error_logs_ack.sql`

- `trigger_error_logs`에 `acked_at TIMESTAMPTZ NULL` 컬럼 추가
- `acked_by UUID REFERENCES auth.users(id)` 추가
- `ack_trigger_error_log(p_id UUID)` RPC 생성 (admin 권한 체크)
- `ack_all_trigger_errors()` RPC — 전체 일괄 확인 처리
- `get_unacked_trigger_error_count()` RPC — Bell 배지용 빠른 카운트

idempotent 패턴 준수.

### Phase 1-B: 이메일 발송 계층

**의존성 추가**: `npm install resend`

**파일 신규**:
- `lib/email/resend-client.ts` — Resend 싱글톤 + 도메인/발신자 config
- `lib/email/daily-digest-template.tsx` — React email template (지난 24h 집계)
- `app/api/cron/daily-digest/route.ts` — Vercel Cron 엔드포인트

**로직 요약**:
```ts
// /api/cron/daily-digest/route.ts
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // 1. Bearer CRON_SECRET 검증
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. 지난 24시간 에러 조회 (service_role 클라이언트)
  const { data: errors } = await supabaseAdmin
    .from('trigger_error_logs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: false });

  // 3. 0건이면 발송 안 함 (노이즈 방지)
  if (!errors || errors.length === 0) {
    return Response.json({ sent: false, reason: 'no_errors' });
  }

  // 4. Resend로 발송
  await resend.emails.send({
    from: 'Pocolush <alerts@pocolush.com>',
    to: [process.env.DIAGNOSTICS_EMAIL_TO!],
    subject: `[Pocolush] 지난 24시간 오류 ${errors.length}건 감지`,
    react: <DailyDigest errors={errors} />,
  });

  return Response.json({ sent: true, count: errors.length });
}
```

**보안**:
- `CRON_SECRET` Authorization 헤더 없으면 401
- service_role 클라이언트는 서버 전용 `lib/supabase/admin.ts` (기존 있으면 재사용)
- 이메일 본문에 PII 금지 — `rental_id`, `sqlstate`, `message`, 대시보드 링크만

### Phase 1-C: 대시보드 UI

**파일 신규**:
- `components/layout/DiagnosticsBell.tsx` — 헤더용 Bell 아이콘 + 빨간 배지
- `app/dashboard/admin/diagnostics/page.tsx` — 진단 페이지
- `components/diagnostics/ErrorLogTable.tsx` — 에러 목록 테이블
- `components/diagnostics/AckButton.tsx` — 개별/일괄 확인 버튼

**DiagnosticsBell 동작**:
```tsx
'use server';
// Server Component, 5분 캐시
async function DiagnosticsBell() {
  'use cache';
  cacheLife('minutes');
  cacheTag('diagnostics');

  const count = await supabase.rpc('get_unacked_trigger_error_count');
  return (
    <Link href="/dashboard/admin/diagnostics" className="relative">
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red text-white text-[10px] rounded-full size-4 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
```

**진단 페이지**:
- 최근 50건 테이블 (function_name, sqlstate, message, context JSON, created_at, acked)
- 필터: 미확인만 / 전체
- 행 hover 시 "확인" 버튼 표시
- 상단 "모두 확인 처리" 버튼
- 컨텍스트는 expandable JSON viewer
- 빈 상태: 초록 체크 아이콘 + "최근 24시간 문제 없음"

**기존 `layout.tsx`에 Bell 통합**:
- `components/layout/Sidebar.tsx` 또는 top header 영역
- admin role일 때만 노출 (RLS 이외에 UI에서도 gate)

### Phase 1-D: 인프라 & 설정

**파일 신규**:
- `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 9 * * *" }
  ]
}
```

**환경변수 추가** (`.env.local` + Vercel dashboard):
- `RESEND_API_KEY`
- `CRON_SECRET` (랜덤 32자)
- `DIAGNOSTICS_EMAIL_TO` (기본: `admin@pocolush.test` or 실제 운영 이메일)
- `RESEND_FROM_EMAIL` (기본: `Pocolush <onboarding@resend.dev>` — 도메인 인증 전)

**Resend 초기 설정** (kk 작업):
1. https://resend.com 가입 (Vercel Marketplace 경유 시 자동 연동)
2. API key 발급
3. 도메인 인증 (선택, 초기엔 resend.dev 기본값 사용)

---

## 2. 파일별 변경 내역

### 신규 (11건)

| 파일 | 역할 |
|------|------|
| `supabase/migrations/021_trigger_error_logs_ack.sql` | ack 컬럼 + 3 RPC |
| `lib/email/resend-client.ts` | Resend 클라이언트 |
| `lib/email/daily-digest-template.tsx` | React email |
| `app/api/cron/daily-digest/route.ts` | Cron 엔드포인트 |
| `app/dashboard/admin/diagnostics/page.tsx` | 진단 페이지 |
| `components/layout/DiagnosticsBell.tsx` | Bell 배지 |
| `components/diagnostics/ErrorLogTable.tsx` | 에러 표 |
| `components/diagnostics/AckButton.tsx` | 확인 버튼 |
| `components/diagnostics/ErrorContextViewer.tsx` | JSON context 확장 뷰 |
| `vercel.json` | Cron 등록 |
| `thoughts/plans/20260416-1900_auto_reporting_plan.md` | 본 파일 |

### 수정 (3건)

| 파일 | 변경 |
|------|------|
| `components/layout/*.tsx` (Sidebar/Header) | Bell 컴포넌트 통합 |
| `types/index.ts` | `TriggerErrorLog` 타입 추가 |
| `package.json` | `resend` 의존성 추가 |

---

## 3. 배포/적용 순서

1. **Resend 가입 + API Key** (kk 작업)
2. **환경변수 등록** (로컬 + Vercel)
3. **migration 021 적용** (SQL Editor)
4. **npm install resend** + 코드 작성/push
5. **Vercel 배포** → Cron 자동 등록
6. **검증**:
   - 인위적 에러 row INSERT → 대시보드 배지 +1 확인
   - `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/daily-digest` → 이메일 수신 확인
   - 0건일 때 이메일 미발송 확인
   - Playwright E2E로 ack flow 검증

---

## 4. 테스트 계획

### 단위
- `/api/cron/daily-digest`:
  - Auth 없음 → 401
  - 0건 → 발송 안 함
  - 5건 → Resend 호출 1회

### 통합
- migration 021 적용 후 RPC 동작 확인
- Resend 테스트 이메일로 실 발송

### E2E (Playwright)
1. trigger_error_logs INSERT (서비스롤) → admin 로그인 → Bell 배지 +1
2. 진단 페이지 진입 → 에러 1건 노출 → "확인" 클릭 → 배지 0
3. "모두 확인" 버튼 동작 확인
4. 빈 상태 렌더링 확인

---

## 5. 성공 기준

- [ ] 관리자가 **매일 오전 9시**에 이메일로 전일 에러 요약 수신 (0건이면 미발송)
- [ ] `/dashboard/*` 로그인 시 **5분 이내 Bell 배지**에 미확인 건수 반영
- [ ] 진단 페이지에서 1-클릭으로 에러 확인 처리
- [ ] 이메일 본문에 PII 포함 없음
- [ ] CRON_SECRET 누락 시 401 확인
- [ ] 24시간 감지 지연 이하 보장

---

## 6. 리스크

| 리스크 | 완화 |
|--------|------|
| Resend 무료 티어 초과 (3000/월) | 운영팀 규모상 미도달. 이메일 0건 정책으로 대부분 월 30통 내 |
| Vercel Cron Hobby 제한 (하루 2회) | 1회/일만 사용 → 여유 충분 |
| CRON_SECRET 유출 시 임의 실행 | service_role만 접근 가능 + secret 주기적 rotate |
| Resend 도메인 인증 전 → `onboarding@resend.dev` 발신 → 스팸 분류 위험 | 초기 테스트 후 kk 도메인 인증 권장 |
| `trigger_error_logs` 대량 발생 시 이메일 길이 폭증 | 최대 20건까지만 상세, 초과분은 "... 외 N건" 처리 + 대시보드 링크 |
| Server Component `'use cache'` + Next.js 16 호환 | `cacheComponents: true` 아직 미적용이면 `revalidate: 300` fallback |
| Supabase Webhook은 제외했지만 즉시 대응 필요 이슈 발생 시 | Phase 2에서 옵션 D 추가 |

---

## 7. Phase 2 예고 (본 플랜 아님)

- **즉시 알림 (Supabase Database Webhook)**: `trigger_error_logs` INSERT → Vercel API → Slack/Email 즉시 발송
- **Slack 통합**: Slack Incoming Webhook URL 환경변수로 다채널 발송
- **에러 그룹핑**: 동일 sqlstate + function_name 은 하루 1회만 이메일 (dedup)
- **Weekly 리포트**: 주간 추세 요약 (Mon 9AM)

---

## 8. kk 피드백 (구현 전 확인)

- [ ] **이메일 수신자** 어디로 할지? (기본 `admin@pocolush.test` — 실제 운영 이메일 있으면 알려줘)
- [ ] **Resend 가입** 진행 OK? 가입 후 API key만 전달해 주면 나머지 내가 세팅
- [ ] **일일 발송 시각** `오전 9시` OK? (다른 시각 원하면 cron 수정)
- [ ] **0건일 때 이메일 미발송** 정책 OK? (아니면 "문제 없음" 이메일도 보낼지)
- [ ] **Slack 쓰는지** — 쓴다면 Incoming Webhook URL 준비 가능? (옵션, 이메일만도 OK)
- [ ] 진단 페이지 경로 `/dashboard/admin/diagnostics` OK?
- [ ] Bell 아이콘 위치 — **좌측 사이드바 하단** vs **상단 헤더 우측** 중 선호?

---

## 9. 승인 후 작업 흐름

```
kk 승인
  └─ Resend 가입 + API key 공유
     └─ 환경변수 등록
        └─ /implement 시작
           ├─ migration 021 작성 + 적용
           ├─ 코드 작성 (11개 신규 + 3개 수정)
           ├─ 로컬 빌드 + 타입체크
           ├─ Playwright E2E
           ├─ Vercel 배포
           └─ 실제 발송 검증 (인위적 에러 row → 내일 9AM 이메일)
```

---

## 10. 예상 소요

| 단계 | 예상 작업량 |
|------|-------------|
| migration 021 | 작은 편 |
| Resend 클라이언트 + 템플릿 | 중간 |
| Cron route | 작은 편 |
| 진단 페이지 + Bell | 중간 |
| E2E | 중간 |
| 배포 + 검증 | 작은 편 |

**총**: 하루 이내 (Resend 설정 제외).

---

## 11. 후속 문서 업데이트

구현 완료 후:
- `CLAUDE.md`에 "관리자 진단 시스템" 섹션 추가
  - 일일 이메일 수신 위치, 확인 방법
  - 에러 발생 시 대응 플로우
  - trigger_error_logs 수동 쿼리 (backup 경로)
- `README.md` 환경변수 섹션에 RESEND_*, CRON_SECRET 추가
