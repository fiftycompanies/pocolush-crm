/**
 * 결과물 사진 E2E 스펙 — SP-01 ~ SP-16 (v3.1 §4-6)
 *
 * ⚠️ Phase 1 (P1-b): 스켈레톤만 작성 (인프라 확보).
 *    실제 test body 는 Phase 2b 에서 작성.
 *    data-testid 추가 권고:
 *      - sp-file-input, sp-upload-button, sp-pending-item
 *      - sp-drawer, sp-photo-item, sp-gallery-item, sp-lightbox
 *
 * 재정의 (v3.1 델타):
 *   - SP-04a: Storage 실패 → DB INSERT 아예 시도 안 함 (early return)
 *   - SP-04b: Storage 성공 + DB 실패 → Storage 객체 rollback
 *   - SP-09: < 500KB + 원본 대비 50% 압축
 *   - SP-11: .maybeSingle() 금지, 빈 배열 assertion
 *   - SP-13~16: pg_cron 이관 추가 (cron 041 검증)
 */

import { test, expect } from '@playwright/test';
import {
  makeAdminClient,
  ensureTestMember,
  seedProcessingOrder,
  cleanupTestOrder,
} from './helpers/supabase-admin';

test.describe.configure({ mode: 'serial' });

// ══════════════════════════════════════════════════
// 관리자 사진 업로드 (SP-01 ~ SP-04, SP-09, SP-12)
// ══════════════════════════════════════════════════
test.describe('관리자 — 사진 업로드', () => {
  let orderId: string;
  let memberId: string;

  test.beforeAll(async () => {
    const admin = makeAdminClient();
    const member = await ensureTestMember(admin);
    memberId = member.id;
    const order = await seedProcessingOrder(admin, memberId);
    orderId = order.id;
  });

  test.afterAll(async () => {
    if (orderId) {
      const admin = makeAdminClient();
      await cleanupTestOrder(admin, orderId);
    }
  });

  test.skip('SP-01 @smoke — 어드민 JPEG 업로드 → DB row + Storage 객체 존재', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-02 — 동일 파일 2회 업로드 → 성공 2건 (중복 허용)', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-03 @smoke — 100MB 초과 파일 rejection', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-04a — Storage 업로드 실패 시 DB INSERT 시도 안 함 (early return)', async () => {
    // TODO Phase 2b
    // page.route('**/storage/v1/**', route => route.abort()) 로 Storage 차단
    // DB row 가 생성되지 않았는지 검증
  });

  test.skip('SP-04b — Storage 성공 + DB INSERT 실패 → Storage 객체 rollback', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-09 — 4000x3000 원본 → 1600px 이하 + < 500KB + 원본 50% 압축', async () => {
    // TODO Phase 2b
    // huge.jpg 업로드 후 Storage object size < 500KB 검증
    // + size < 원본 * 0.5
  });

  test.skip('SP-12 — non-image (text/plain) rejection', async () => {
    // TODO Phase 2b
  });
});

// ══════════════════════════════════════════════════
// 고객 사진 열람 (SP-05 ~ SP-08, SP-10, SP-11)
// ══════════════════════════════════════════════════
test.describe('고객 — 사진 열람', () => {
  let orderId: string;
  let memberId: string;

  test.beforeAll(async () => {
    const admin = makeAdminClient();
    const member = await ensureTestMember(admin);
    memberId = member.id;
    const order = await seedProcessingOrder(admin, memberId, { note: '고객 열람 시나리오' });
    orderId = order.id;
    // 실제 사진 업로드는 Phase 2b에서
  });

  test.afterAll(async () => {
    if (orderId) {
      const admin = makeAdminClient();
      await cleanupTestOrder(admin, orderId);
    }
  });

  test.skip('SP-05 @smoke — 고객 /member/store/orders/[id] 라이트박스 열림 + 사진 개수', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-06 — 라이트박스 키보드(ESC/←/→) + 배경 클릭 닫기 + focus trap', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-07 @smoke — 어드민 사진 삭제 → audit_logs delete_service_photo 기록', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-08 — 고객 인앱 알림 수신 (member_notifications INSERT)', async () => {
    // TODO Phase 2b
    // 046b 마이그 적용 후 recipient 가 마스킹 되어 있는지도 검증
  });

  test.skip('SP-10 — audit_logs 3종 (complete/delete/view) 기록', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-11 — RLS: 다른 멤버로 해당 주문 photo SELECT 시 빈 배열 반환', async () => {
    // TODO Phase 2b
    // .maybeSingle() 금지, filter + expect(data).toEqual([])
  });
});

// ══════════════════════════════════════════════════
// pg_cron 041 cleanup 검증 (SP-13 ~ SP-16)
// v3.1 §4-6 추가 — Phase 3c 실삭제 전환 전 관찰
// ══════════════════════════════════════════════════
test.describe('pg_cron — cleanup_service_photos', () => {
  test.skip('SP-13 — dry-run 모드 RPC 직접 호출 → cleanup_logs.status=\'success\'', async () => {
    // TODO Phase 2b
    // supabase.rpc('cleanup_service_photos_cron') 또는 수동 INSERT
  });

  test.skip('SP-14 — seed orphan 10건 → cleanup_logs.candidates_count >= 10', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-15 — DB 0 rows + Storage 100건 → orphan_ratio>0.5 → status=\'aborted\'', async () => {
    // TODO Phase 2b
  });

  test.skip('SP-16 — Staging 전용 execute 모드 실삭제 (ALLOW_PROD_WRITE=no 일 때 자동 skip)', async () => {
    // TODO Phase 2b
    test.skip(process.env.ALLOW_PROD_WRITE !== 'yes', 'execute 모드는 명시적 승인 필요');
  });
});
