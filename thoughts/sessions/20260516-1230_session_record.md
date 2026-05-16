# 세션 기록 — 2026-05-16 11:00 ~ 12:30 (Plan B 3 잔존 이슈 hotfix)

**기간**: 2026-05-16 11:00 ~ 12:30 (약 1.5h)
**핵심 주제**: 3 잔존 이슈 분리 3 커밋 hotfix — Q1=A / Q2=A / Q3=A / Q4=2 권고대로 진행
**바베큐 페이지 제외 지시**: Plan A 자동갱신 UX 건너뜀

---

## 1. 작업 흐름

```
이전 세션 핸드오프 읽기 →
운영 정합성 SQL 통과 (29→30 신규 예약 +1, dedup 27, 잔존 0) →
커밋 1 (b0701b9): StatsCards nested Link 풀기 →
커밋 2 (38630f0): /dashboard #418 useState/useEffect →
커밋 3 (9de7b51): lib/supabase/client.ts singleton + accessToken →
push → prod 빌드 49s → Ready →
Playwright prod 검증 (3 이슈 + 회원 회귀)
```

---

## 2. 커밋 (3건)

| 커밋 | 주제 | 영향 |
|---|---|---|
| `b0701b9` | fix(stats-cards): nested Link 풀기 (HTML invalid + hydration warning 제거) | dashboard 진입 console.error 2건 → 0건 ✅ |
| `38630f0` | fix(dashboard): React #418 hydration mismatch — useState/useEffect 패턴 | 자정 ±2초 #418 0건 ✅ |
| `9de7b51` | fix(supabase): client singleton + realtime accessToken — WebSocket 401 차단 | ⚠ **fix 효과 미발현 — 401 16건 여전히 발생 (다음 세션 후속)** |

---

## 3. prod 검증 결과

### 3-1. 이슈 1 (#418) — ✅ 완전 해결

| 측정 | Before | After |
|---|---|---|
| /dashboard 진입 pageerror | 1건 (React #418) | **0건** |
| /dashboard/bbq-board 추가 | - | **0건** |

### 3-2. 이슈 3 (Nested Link) — ✅ 완전 해결

| 측정 | Before | After |
|---|---|---|
| /dashboard console.error | 2건 (`<a><a>` 중첩) | **0건** |

### 3-3. 이슈 2 (Realtime 401) — ⚠ 미해결, 후속 필요

| 측정 | Before | After |
|---|---|---|
| /dashboard 5s ws_401 | (이전 측정 없음) | **6건** |
| /dashboard/bbq-board 5s 추가 ws_401 | 8건 | **10건** |
| 합계 | 8건 | **16건** |

**진단**: singleton + `accessTokenFn` 패턴 적용했으나 첫 connection 시점 race condition 의심:
- `_client = _make(url, key)` 호출 중 createBrowserClient 내부에서 즉시 WebSocket connection 시도
- `accessTokenFn`이 호출되는 시점에 `_client` 변수가 아직 할당 전 → `null` 반환 → anon fallback
- 결과적으로 첫 connection은 여전히 anon → 401

**가능 해결 (다음 세션)**:
1. `_client` 생성 직후 명시적 `realtime.setAuth(token)` 호출
2. localStorage 의 supabase session 동기 읽어서 access_token 직접 전달 (시동 시점에 토큰 보유)
3. `@supabase/ssr` wrapper가 realtime 옵션을 정확히 전달하는지 검증
4. supabase-js 디버깅 로그 활성화하여 connection 흐름 분석

### 3-4. 회원 측 회귀 — ✅ 정상

| 페이지 | 상태 |
|---|---|
| `/m/login` | 200 OK |
| singleton client 공유 | 정상 (build pass, /m/login 응답) |

---

## 4. 8축 + 7점 검수 결과

| 축 | 이슈 1 | 이슈 2 | 이슈 3 |
|---|---|---|---|
| A 보안 | ✅ | ✅ (intent OK) | ✅ |
| B RLS | ✅ | ✅ (RLS 미영향) | ✅ |
| C UX | ✅ | ⚠ 콘솔 노이즈 | ✅ |
| D 성능 | ✅ | ⚠ 16건 reconnect | ✅ |
| E 통합/회귀 | ✅ | ✅ /m/login 정상 | ✅ |
| F 데이터명 | ✅ | ✅ | ✅ |
| G 사이드이펙트 | ✅ 첫 렌더 빈 표시 50ms | ⚠ singleton/타입 변경 영향 | ✅ |
| H 배포 안전 | ✅ | ✅ 즉시 롤백 가능 | ✅ |

**7점**: #1 #2 #5 #6 모두 통과 (build 0 error).

---

## 5. 신규 발견 (다음 세션 후속)

| # | 항목 | 위험 | 추정 |
|---|---|---|---|
| **NEW-1** | Realtime 401 fix 의도 미달 — singleton+accessToken 적용 후에도 16건 잔존 | MID | 다음 세션 우선 후속 (research §재진단 필요) |
| **NEW-2** | _client 생성 race 가능성 (createBrowserClient 동기 내부에서 connection 시도) | MID | 명시적 setAuth 직후 호출 패턴 검토 |

---

## 6. 핵심 상수 (변경 없음)

| 항목 | 값 |
|---|---|
| admin | `admin@pocolush.co.kr` / `123456` |
| Supabase project | `lhuaxmzsvrmjavanunnv` |
| prod URL (어드민) | https://app.pocolush.com |
| prod URL (공개) | https://www.pocolush.com |
| 다음 마이그레이션 번호 | **082** |
| Vercel CLI | 50.42.0 → **54.1.0** 권고 |
| Vercel env IA_V2 | 활성 (`NEXT_PUBLIC_SIDEBAR_IA_V2=1`) |

---

## 7. 운영 데이터 (Supabase MCP 실측, 12:30)

```
회원              60+ approved
BBQ 예약          30 (+1 신규)
시설              5 (활성 4 + 비활성 1)
타임슬롯          3 (모두 활성)
상품              1 ("평상 예약 (기본)" 30,000원)
이벤트            1 ("오픈기념 이벤트" 무료)
audit_logs        24h dedup 27건 (079 1h dedup 정상)
test_residue      0 (이전 cleanup 완벽)
```

---

## 8. 다음 세션 권고

### 즉시 (P0)
1. **Realtime 401 재진단** — singleton+accessToken 작동 안 한 원인 분석
   - 옵션 a: createBrowserClient 직후 `_client.realtime.setAuth(token)` 명시 호출
   - 옵션 b: localStorage 직접 동기 읽기로 initial token 보장
   - 옵션 c: 다른 클라이언트 라이브러리 (예: createClient 직접) 시도

### 대기 (P1)
- Plan A 자동갱신 UX 강화 (이번 세션 제외, plan 대기 중)
- A2 13 RPC `is_admin()` 통일
- U2 모바일 햄버거 활성화 (burn-in 완료 후)

### 백로그 (P2~P3)
- U8 ConfirmDialog / Phase D E2E / G8 Playwright 1.60 / G9 CI 야간

---

## END — 3 이슈 중 2건 완전 해결, 1건 (Realtime 401) 후속 조사 필요.
