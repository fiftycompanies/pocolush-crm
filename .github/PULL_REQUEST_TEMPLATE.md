# PR 요약

<!-- 이 PR이 해결하는 문제를 1~2문장으로 -->

## 변경 유형
- [ ] feat (신규 기능)
- [ ] fix (버그 수정)
- [ ] refactor (리팩토링)
- [ ] docs (문서)
- [ ] test (테스트)
- [ ] chore (설정/빌드)
- [ ] migration (DB 마이그)
- [ ] security (보안)

## 관련 플랜/이슈
- plan: `thoughts/plans/...`
- 영향 항목: #1/#2/#3/#4/#5/#6 중 (해당 시)

## 테스트
- [ ] 단위/통합 테스트 추가
- [ ] Playwright E2E 통과 (해당 시)
- [ ] 수동 QA 체크
- [ ] `tsc --noEmit` 통과
- [ ] `npm run lint` 통과

## 7점 체크 (해당되는 항목만 ✅)
- [ ] #1 인증/권한 — 새 엔드포인트/RPC 권한 체크
- [ ] #2 비정상 동작 경로 — catch 블록 swallow 없음, 에러 핸들링
- [ ] #3 중복 요청/동시성 — idempotency 또는 lock
- [ ] #4 DB 정합성 — 트랜잭션 or 단일 SQL 원자성
- [ ] #5 비밀정보 노출 — 로그/응답/URL 에 토큰/개인정보 없음
- [ ] #6 런타임 이슈 — deprecated API 없음, tsc/lint 통과
- [ ] #7 배포 후 대응 — 로그 위치 명확, 롤백 가능

## 마이그레이션 체크리스트 (DB 변경 시)
- [ ] `supabase/migrations/NNN_*.sql` 추가
- [ ] Supabase SQL Editor 파싱 호환 (SELECT INTO 금지, BEFORE 트리거 선호)
- [ ] RLS 정책 추가
- [ ] `types/` 에 대응 타입 추가
- [ ] 로컬/staging에서 실행 검증

## 배포 후 확인
- [ ] Vercel Preview 브라우저 확인
- [ ] 로그 (Sentry/Axiom/Supabase) 에러 급증 없음
- [ ] 롤백 절차 Runbook 링크

## 체크리스트
- [ ] PR 제목: conventional commits 형식 (`feat:`, `fix:`, `migration:` 등)
- [ ] 관련 문서/스크린샷 첨부
- [ ] 스크린샷/GIF (UI 변경 시)

---

<!-- 리뷰어: CLAUDE.md 의 7점 체크리스트 기반으로 리뷰 -->
