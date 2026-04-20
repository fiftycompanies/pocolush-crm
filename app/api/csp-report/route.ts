// CSP Violation Report 수집 엔드포인트
// Phase 0: Report-Only 모드로 수집만. Phase 3b에서 enforce 전환.
// DoS 방어: Content-Type 검증, 10KB 제한, Origin 화이트리스트

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 10 * 1024;
const ALLOWED_HOSTS = /pocolush\.com$/;

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('json') && !ct.includes('csp-report')) {
    return new Response(null, { status: 415 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  try {
    const report = JSON.parse(raw);
    const uri =
      report?.['csp-report']?.['document-uri'] ??
      report?.body?.documentURL ??
      '';

    if (uri) {
      try {
        if (!ALLOWED_HOSTS.test(new URL(uri).host)) {
          return new Response(null, { status: 204 });
        }
      } catch {
        // malformed URI — skip origin check
      }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return new Response(null, { status: 204 });
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    await supabase.from('csp_violations').insert({
      document_uri: typeof uri === 'string' ? uri.slice(0, 2000) : null,
      violated_directive:
        report?.['csp-report']?.['violated-directive'] ??
        report?.body?.effectiveDirective ??
        null,
      blocked_uri:
        (report?.['csp-report']?.['blocked-uri'] ??
        report?.body?.blockedURL ??
        '').slice(0, 2000),
      user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      raw: report,
    });
  } catch {
    // swallow parse/insert errors
  }

  return new Response(null, { status: 204 });
}
