// Vercel Cron: 매일 KST 00:05에 만료 처리
// vercel.json에 등록: { "path": "/api/cron/expire-memberships", "schedule": "5 15 * * *" }
// CRON_SECRET 헤더로 보호 (Vercel Cron은 자동으로 Authorization: Bearer <CRON_SECRET> 첨부)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  // CRON_SECRET 필수. 미설정이거나 불일치 시 401.
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const started = new Date().toISOString();
  const { data, error } = await supabase.rpc('auto_expire_memberships');

  if (error) {
    console.error('[cron/expire-memberships] error', error);
    return NextResponse.json(
      { ok: false, error: error.message, started },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    started,
    finished: new Date().toISOString(),
    result: data ?? null,
  });
}
