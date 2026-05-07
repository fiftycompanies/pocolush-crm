# 세션 기록: 바베큐 타임슬롯 DB CRUD 전환

> 날짜: 2026-05-07 18:30 ~ 완료
> 작업: 하드코딩된 BBQ 타임슬롯을 DB 기반 CRUD로 전환

---

## 완료 사항

### 1. 리서치 (`/research`)
- CRM 전체 구조 8스킬 병렬 분석
- 타임슬롯 하드코딩 위치 10개 파일 식별
- 엑셀 export에서 시간 불일치 버그 발견 (10:00-13:00 vs 11:00~13:50)
- 저장: `thoughts/research/20260507-1830_bbq_timeslot_crud_research.md`

### 2. 플랜 (`/plan`)
- 독립 테이블 `bbq_time_slots` 설계 (옵션 A 채택)
- 8스킬 검수: FAIL 6건 + WARN 13건 발견 → 전부 플랜에 반영
- 7점 보안/품질 체크 완료
- 저장: `thoughts/plans/20260507-1830_bbq_timeslot_crud_plan.md`

### 3. 구현 (`/implement`)
변경 파일 13개:

| 파일 | 변경 |
|------|------|
| `supabase/migrations/059_bbq_time_slots.sql` | 신규 — 테이블+시드+FK+RLS+RPC |
| `supabase/migrations/059_rollback.sql` | 신규 — 롤백 스크립트 |
| `lib/use-time-slots.ts` | 신규 — 커스텀 훅 (slotMap, useMemo, 폴백 헬퍼) |
| `types/index.ts` | BBQTimeSlot 추가, time_slot: number 완화 |
| `lib/member-constants.ts` | TIME_SLOTS → TIME_SLOTS_FALLBACK |
| `app/dashboard/bbq/page.tsx` | 타임슬롯 CRUD UI (추가/수정/삭제/토글/감사로그) |
| `components/member/TimeSlotSelector.tsx` | DB 기반 동적 렌더링 + 빈 상태 |
| `app/member/reservation/page.tsx` | 1쿼리 가용성, INVALID_TIME_SLOT 처리 |
| `app/member/reservation/[id]/page.tsx` | useTimeSlots 전환 |
| `app/member/reservation/history/page.tsx` | useTimeSlots 전환 |
| `app/member/page.tsx` | useTimeSlots 전환 |
| `components/admin-members/MemberBBQTab.tsx` | useTimeSlots 전환 |
| `app/api/export/route.ts` | DB 조회로 시간 불일치 버그 수정 |

### 4. 검수 (구현 후 2차 8스킬)
- FAIL 1건 발견 → 즉시 수정: `selectedSlot !== null` (0번 슬롯 falsy 버그)
- WARN: updated_at 중복 제거
- 최종: FAIL 0건, WARN 6건(경미)

### 5. 배포
1. Supabase 마이그레이션 적용 → 성공 (시드 3건, FK, RLS 확인)
2. git push → Vercel Production 배포 완료

### 6. E2E 테스트 (실배포 브라우저)
- Playwright로 app.pocolush.com 실브라우저 테스트
- **8건 전체 통과**: 조회, 추가, 수정, 토글, 유효성검증, 삭제, 보호가드, 회원예약
- 테스트 데이터 정리 완료

---

## 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| 독립 테이블 (상품 종속 X) | 모든 시설이 동일 타임 공유, 추후 확장 가능 |
| slot_number INTEGER FK | 기존 time_slot 정수 호환, bbq_facilities.number 패턴 일치 |
| ON DELETE RESTRICT | 예약 있는 슬롯 삭제 차단 → soft-delete 유도 |
| ON UPDATE CASCADE | slot_number 변경 시 기존 예약 자동 업데이트 |
| CHECK 동적 DROP | pg_constraint 조회로 자동 생성 이름 대응 |
| search_path = '' | 004 보안 패턴 통일 |
| 1쿼리 가용성 | N개 순차 쿼리 → 1개로 최적화 |

## 다음 세션 참고

- `TIME_SLOTS_FALLBACK`는 어디서도 import되지 않음 — 필요시 제거 가능
- `useTimeSlots()` 캐시 없음 — 데이터 변경 빈도 낮아 당장 불필요, 향후 SWR 도입 가능
- 회원 예약 E2E는 회원 테스트 계정 생성 후 별도 검증 필요
