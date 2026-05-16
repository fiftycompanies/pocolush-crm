# kk 사후/사전 조치 종합 안내 — 2026-05-17 01:00

> 이번 세션 (PR-X/A/C1/C2/B) prod 배포 완료 후 kk 가 직접 처리해야 할 외부 작업 정리.

---

## 🔴 즉시 (이번 주)

### 1. Prod 어드민 비번 rotation + GitHub Secret 등록 (PR-X 후속)

**배경**: `e2e/*.spec.ts` 에 prod admin 비번 `123456` 평문 노출 (git history 잔존). PR-X (721d370) 로 코드는 제거했으나 비번 자체 변경 필요.

**작업**:
1. **Supabase Dashboard 어드민 비번 변경**
   - https://supabase.com/dashboard/project/lhuaxmzsvrmjavanunnv/auth/users
   - `admin@pocolush.co.kr` 비번 강력 패스워드로 변경 (16자+ 권장)
2. **GitHub Secrets 등록**
   - https://github.com/fiftycompanies/pocolush-crm/settings/secrets/actions
   - 신규 Secret 2개:
     - `E2E_ADMIN_EMAIL` (선택, 기본 admin@pocolush.co.kr)
     - `E2E_ADMIN_PW` (필수, rotation 한 비번)
3. **CI workflow env 매핑** (다음 PR 또는 직접 commit):
   ```yaml
   # .github/workflows/pr-check.yml + e2e-full.yml
   env:
     E2E_ADMIN_PW: ${{ secrets.E2E_ADMIN_PW }}
   ```
4. **local .env.local** 에 `E2E_ADMIN_PW=<rotation 비번>` 추가

**검증**: `vercel env list` 또는 GitHub Secret 페이지 확인. CI pr-check (smoke) 통과 확인.

**Risk**: ⚠ rotation 전까지는 prod admin 비번이 여전히 약함 — **즉시 작업 권고**

---

### 2. Cloudflare wildcard cert 정리 (Q5=kk직접)

**배경**: Cloudflare 가 발신한 "Validate the domain pocolush.com" 알림 무시 가능 (Vercel Let's Encrypt 자동 갱신 중). Universal SSL 정리하면 알림 중단.

**작업**:
1. https://dash.cloudflare.com → `pocolush.com` 선택
2. **SSL/TLS** → **Edge Certificates** 메뉴
3. **Universal SSL** 토글 **OFF** (또는 Custom Cert 삭제)
4. (선택) **DNS** → A 레코드가 Vercel IP (`216.150.x.65`) 인지 확인 — Cloudflare proxy 모드면 끄기 (`DNS only` 모드)

**검증**: `dig pocolush.com` → Vercel IP 만 반환 + 인증 갱신 알림 이메일 중단

**Risk**: 0 (Vercel SSL termination 무영향)

---

## 🟡 5/22 이후 (burn-in 종료)

### 3. NEXT_PUBLIC_SIDEBAR_MOBILE_V2 활성화 (Q-B1=5/22)

**배경**: 모바일 햄버거 V2 (focus trap + ESC + body overflow + 백드롭). 5/22 burn-in 종료 후 활성화.

**작업**:
```bash
cd ~/Desktop/claude/pocolush/pocolush-crm
printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
vercel deploy --prod --yes
```

**검증** (375px viewport):
- 햄버거 클릭 → 사이드바 슬라이드인 + 백드롭 표시
- ESC 누름 → 닫힘
- 백드롭 클릭 → 닫힘
- 데스크탑 1280px viewport 회귀 0

**Risk**: 0 (DashboardShell.tsx 단일 분기, 데스크탑 영향 없음)

---

## 🟢 5일 lead time 사전 작업 (PR-D 알림톡 D-30 cron 전제)

### 4. Aligo 알림톡 템플릿 등록 + 카카오 검수 (Q-D2=phone만)

**배경**: PR-D (알림톡 D-30 cron) 진행 전 필수. 카카오 알림톡은 사전 등록 + 검수 통과한 템플릿만 발송 가능 (3~5 영업일).

**작업**:
1. **Aligo 어드민 로그인** (`ALIGO_USER_ID`)
2. **알림톡 템플릿 신규 등록**
   - 템플릿 코드 (예: `POCO_EXP_30`)
   - 메시지 본문 (변수 치환 `#{...}` 형식):
     ```
     [포코러쉬]
     #{member_name}님, 회원권 만료까지 #{days_left}일 남았습니다.

     ▶ 만료일: #{end_date}
     ▶ 연장 문의: 010-XXXX-XXXX
     ▶ 마이페이지: https://app.pocolush.com/m/mypage?source=alimtalk_d30
     ```
3. **카카오 검수 신청** → 3~5 영업일 대기
4. 승인 후 템플릿 코드 + 본문 최종본을 PR-D 진행 시 Claude 에게 공유

**검증**: Aligo 어드민에서 "승인 완료" 상태 확인

**Risk**: 사전 작업 누락 시 PR-D 100% 발송 실패 (모든 알림 reject)

### 5. 환경변수 확인

```bash
vercel env ls production | grep ALIGO
# 필요 변수:
# - ALIGO_API_KEY
# - ALIGO_USER_ID
# - ALIGO_SENDER
# - ALIGO_SENDER_KEY (선택)
```

---

## 📦 이번 세션 prod 배포 (5 PR + 1 commit)

```
721d370  security(e2e): ADMIN_PW 평문 제거 (PR-X)
27fb6f2  fix(farms-board): Q-A1 expired 행 toast (PR-A)
321a3d7  feat(kpi): 만료 D-7/D-30 한 카드 2-값 (PR-C1)
b435d3e  feat(ui): ConfirmDialog + Phase 1 4건 (PR-C2)
01b92a8  chore(e2e): Playwright 1.60 (PR-B)
```

운영 정합성 모두 정상 ✅

---

## 🔵 외부 P2 (별도 결정)

### 6. Realtime 401 (옵션 D) Supabase support / GitHub issue

6차 시도 후 5건 잔존 (82% 감소). server-side 점검 필요.
- Supabase support 또는 https://github.com/supabase/realtime/issues 등록
- 진단 패키지: `thoughts/sessions/20260516-2200_handover.md` §Realtime 401 결과 매트릭스

**Risk**: 0 (외부 문의만)

---

## END — 위 1-5 작업 완료 후 다음 세션에서 PR-D (알림톡 D-30 cron) 진행
