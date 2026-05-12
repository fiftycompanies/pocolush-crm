# 다음 세션 시작 프롬프트 (복사 → Claude 에게 붙여넣기)

---

## 안내 (복사 영역)

```
pocolush-crm 에서 이전 세션(Phase 0.5) 마무리 후 이어서 작업할 거야.

먼저 이 3개 파일 읽어서 컨텍스트 복구해:
1. thoughts/sessions/20260424-1656_phase0.5_완료_session_record.md
2. thoughts/sessions/20260424-1656_next_session_prompt.md (이 파일)
3. ~/.claude/projects/-Users-kk-Desktop-claude-pocolush/memory/MEMORY.md

읽고 나면 현재 배포 상태(Phase 0.5 + C-1 hotfix 모두 prod 반영됨) 를 한 줄로 확인하고,
아래 "운영 체크 2건" 을 먼저 실행해서 결과 보고해.

## 운영 체크 1 — Vault secrets 등록 확인
Supabase SQL Editor 에서 실행:
  SELECT name FROM vault.secrets
  WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL');

기대: 2 rows.
0 rows 면 Storage orphan 위험 있으므로 docs/runbooks/notice-image-cleanup.md
시나리오 4 참조하여 등록 SQL 안내.

## 운영 체크 2 — agreed_guide_version 트리거 작동 검증
app.pocolush.com/m/signup 으로 신규 테스트 회원가입 1회 후:
  SELECT name, agreed_guide_version, created_at
  FROM members ORDER BY created_at DESC LIMIT 1;

기대: agreed_guide_version='v2026'.
null 이면 057 트리거가 user_metadata 에서 값을 못 읽은 것 — 트리거 함수
fn_members_agreed_guide_audit 의 NEW.raw_user_meta_data 파싱 로직 재확인.

체크 2개 결과 보고 후 다음 중 원하는 걸로 진행해:

(A) 백로그 정리
    - H1/H2 PIPA 4대 고지 + IP/UA 수집 (법무 검토 필요)
    - FIXME-LINT-0.5 ESLint warn → error 복구
    - E2E spec 스타일 통일 (로컬 Playwright 호환)
    - image-utils / upload-service-photo 중복 통합

(B) draft_id B-option 재검토
    - 현재 A안: new 페이지 마운트 시 빈 notices row 선행 생성
    - B안: lazy — 첫 이미지 업로드 시점에 draft 생성
    - B안 전환 PR plan 초안

(C) 새 기능 요구사항 (내가 지금 전달할 예정)

어느 쪽으로 진행할지 묻지 말고, 먼저 운영 체크 2개 결과만 받아서 시작해.
```

---

## 부가 참고 (복사 불필요)

### Phase 0.5 주요 산출물
- 마이그레이션 055/056/057/058 전부 적용 완료
- Dashboard Storage Policies: public-guides, notice-images 각 4개 정책 적용됨
- Vercel env: NEXT_PUBLIC_GUIDE_PDF_URL 등록됨
- PR #1 (`01f406f`) + PR #10 (`6b55a54`) 모두 main merge + Vercel prod Ready

### 현재 GitHub 브랜치 보호
- required_status_checks: Lint+Typecheck, npm audit (high+), Secret Scan, E2E Smoke
- enforce_admins: false (admin 우회 가능)
- required_approving_review_count: 1 (일반 PR 은 kk 승인 필요)

### Sentry / 관측
- `lib/upload-notice-image.ts` rollback 실패 시 Sentry 캡쳐
- `lib/use-notice-image-upload.ts` 업로드 실패 시 Sentry 캡쳐
- 태그: `feature: notice-image-upload`, `phase: rollback`

### 테스트 계정
- 어드민: admin@pocolush.co.kr / 123456
- Playwright local 실행 시 `test.describe` 파서 에러 있음 (CI 는 @smoke grep 으로 회피 가능)
