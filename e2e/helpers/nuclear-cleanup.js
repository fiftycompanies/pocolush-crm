/**
 * CI post-job cleanup — 실패해도 [E2E] prefix 가 붙은 leftover 전부 삭제.
 * .github/workflows/e2e-full.yml 의 post-job 에서 호출.
 *
 * 실행: node e2e/helpers/nuclear-cleanup.js
 * 필수 env: SUPABASE_SERVICE_ROLE_KEY + (SUPABASE_URL | STAGING_SUPABASE_URL)
 */

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STAGING_SUPABASE_SRK;
  if (!url || !srk) {
    console.error('[nuclear-cleanup] URL/SRK 미설정 — skip');
    process.exit(0);
  }
  // prod 안전장치
  if (/lhuaxmzsvrmjavanunnv\.supabase\.co/.test(url) && process.env.ALLOW_PROD_WRITE !== 'yes') {
    console.error('[nuclear-cleanup] prod URL 감지 — ALLOW_PROD_WRITE=yes 없으면 중단');
    process.exit(1);
  }

  const admin = createClient(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. [E2E] 주문 전수 조회
  const { data: orders, error } = await admin
    .from('service_orders')
    .select('id, admin_note')
    .like('admin_note', '[E2E]%');

  if (error) {
    console.error('[nuclear-cleanup] service_orders 조회 실패:', error.message);
    process.exit(1);
  }
  if (!orders || orders.length === 0) {
    console.log('[nuclear-cleanup] leftover 없음');
    return;
  }

  console.log(`[nuclear-cleanup] ${orders.length} 건 정리 시작`);
  let ok = 0, fail = 0;

  for (const order of orders) {
    try {
      // Storage
      const { data: photos } = await admin
        .from('service_order_photos')
        .select('storage_path')
        .eq('service_order_id', order.id);
      if (photos && photos.length > 0) {
        const paths = photos.map(p => p.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await admin.storage.from('service-photos').remove(paths);
        }
      }
      // audit_logs
      await admin.from('audit_logs').delete()
        .eq('resource_id', order.id)
        .eq('resource_type', 'service_order');
      // orders (CASCADE)
      await admin.from('service_orders').delete().eq('id', order.id);
      ok++;
    } catch (e) {
      console.error(`[nuclear-cleanup] ${order.id} 실패:`, e.message);
      fail++;
    }
  }

  console.log(`[nuclear-cleanup] 완료: 성공 ${ok}, 실패 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(e => {
  console.error('[nuclear-cleanup] fatal:', e);
  process.exit(1);
});
