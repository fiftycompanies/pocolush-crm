/**
 * E2E 전용 Supabase Admin 클라이언트 (SERVICE_ROLE_KEY 사용)
 * - Staging 전용 SRK만 사용 (prod 유출 방지 위해 config 시점 검증)
 * - seedProcessingOrder / cleanupTestOrder 헬퍼
 *
 * 사용 예:
 *   import { makeAdminClient, seedProcessingOrder, cleanupTestOrder } from './helpers/supabase-admin';
 *   const admin = makeAdminClient();
 *   const orderId = await seedProcessingOrder(admin, memberId);
 *   ...
 *   await cleanupTestOrder(admin, orderId);
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TEST_ADMIN_NOTE_PREFIX = '[E2E]'; // orphan cron 에서 감지 가능한 prefix

export function makeAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
    || process.env.STAGING_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.STAGING_SUPABASE_SRK;

  if (!url || !srk) {
    throw new Error('[E2E] SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
  }
  // 추가 안전장치: prod URL + ALLOW_PROD_WRITE 미설정 시 차단
  if (/lhuaxmzsvrmjavanunnv\.supabase\.co/.test(url) && process.env.ALLOW_PROD_WRITE !== 'yes') {
    throw new Error('[BLOCKED] E2E admin client 가 prod SRK 로 초기화되려 함. ALLOW_PROD_WRITE=yes 설정 필요');
  }

  return createClient(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * 테스트용 "processing" 상태 service_order 1건 생성.
 * - admin_note 에 [E2E] prefix 남겨 cron 에서 감지 + leftover cleanup 가능
 * - 실패 시 throw (테스트 세션 중단)
 */
export async function seedProcessingOrder(
  admin: SupabaseClient,
  memberId: string,
  opts: { productId?: string; note?: string } = {},
): Promise<{ id: string }> {
  const note = `${TEST_ADMIN_NOTE_PREFIX} ${opts.note ?? 'test seed'} @ ${new Date().toISOString()}`;
  const { data, error } = await admin
    .from('service_orders')
    .insert({
      member_id: memberId,
      status: 'processing',
      admin_note: note,
      product_id: opts.productId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`[E2E] seedProcessingOrder 실패: ${error?.message ?? 'no data'}`);
  }
  return data;
}

/**
 * 테스트 주문 관련 모든 데이터 삭제.
 * 순서 (FK/CASCADE 고려):
 *   1. Storage 객체 (service_order_photos.storage_path 수집 → storage.remove)
 *   2. audit_logs (resource_id + resource_type='service_order')
 *   3. service_orders (CASCADE 로 service_order_photos 자동 삭제)
 */
export async function cleanupTestOrder(admin: SupabaseClient, orderId: string): Promise<void> {
  // 1. Storage path 수집 후 객체 제거
  const { data: photos } = await admin
    .from('service_order_photos')
    .select('storage_path')
    .eq('service_order_id', orderId);

  if (photos && photos.length > 0) {
    const paths = photos.map(p => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await admin.storage.from('service-photos').remove(paths);
    }
  }

  // 2. audit_logs (FK 없음 → orphan 방지 수동 삭제)
  await admin
    .from('audit_logs')
    .delete()
    .eq('resource_id', orderId)
    .eq('resource_type', 'service_order');

  // 3. service_orders (CASCADE)
  await admin.from('service_orders').delete().eq('id', orderId);
}

/**
 * 테스트용 멤버 1건 생성 — 이미 존재하면 재사용.
 */
export async function ensureTestMember(
  admin: SupabaseClient,
  email: string = 'e2e-test@pocolush.test',
): Promise<{ id: string; user_id: string }> {
  // 이미 있는지 확인
  const { data: existing } = await admin
    .from('members')
    .select('id, user_id')
    .eq('email', email)
    .maybeSingle();
  if (existing) return existing;

  // auth.users 생성
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'e2e-test-password-000',
    email_confirm: true,
  });
  if (authErr || !authUser.user) {
    throw new Error(`[E2E] createUser 실패: ${authErr?.message}`);
  }

  // members 생성
  const { data: member, error: memberErr } = await admin
    .from('members')
    .insert({
      user_id: authUser.user.id,
      email,
      name: '[E2E] 테스트 회원',
      phone: '010-0000-0000',
      status: 'approved',
    })
    .select('id, user_id')
    .single();
  if (memberErr || !member) {
    throw new Error(`[E2E] member insert 실패: ${memberErr?.message}`);
  }
  return member;
}
