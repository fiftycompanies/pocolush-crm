import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client — singleton + realtime accessToken
 *
 * 2026-05-16 hotfix (research §이슈 2 — Realtime 401):
 * - 이전: createBrowserClient(url, key) — anon key 만 전달
 *   → 첫 WebSocket connection 이 anon 으로 열림
 *   → setAuth(token) 가 이후 호출돼도 첫 connection 8회 reconnect 시도 = 401 8건
 * - 변경 1: singleton 패턴 — 모든 hook 이 같은 client 공유 (Realtime connection 1개)
 * - 변경 2: realtime.accessToken — 매 connection 직전 호출되어 첫 연결부터 user token 사용
 *
 * @supabase/supabase-js v2.45+ 의 realtime.accessToken 옵션 사용 (현재 v2.98)
 * 근거: thoughts/research/20260516-1000_three_residuals_research.md
 */

// 호출 시그니처 기준 ReturnType 추론 — 직접 ReturnType<typeof createBrowserClient> 보다
// generic 추론이 정확 (Database/Schema 미지정 시 default 일관)
const _make = (url: string, key: string) =>
  createBrowserClient(url, key, {
    realtime: {
      // 매 connection 직전 호출 — 첫 연결부터 user access_token 사용 → 401 race 차단
      accessToken: accessTokenFn,
    },
  });

type BrowserClient = ReturnType<typeof _make>;

let _client: BrowserClient | null = null;

async function accessTokenFn(): Promise<string | null> {
  // _client 가 아직 없거나 placeholder 환경이면 null 반환 → anon key fallback
  if (!_client) return null;
  try {
    const { data: { session } } = await _client.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function createClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Build-time placeholder — singleton 캐싱 안 함 (실 환경은 위 분기 안 옴)
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
    );
  }

  _client = _make(url, key);

  // PR 2 (2026-05-16): Realtime 401 race 차단
  //
  // 배경: createBrowserClient 호출 동안 내부 realtime 즉시 connect 시도 →
  //       accessTokenFn 호출 시 _client 가 아직 null → anon fallback → 8건 401 race.
  //       singleton 생성 직후 명시적 setAuth() 호출하여 첫 reconnect 부터 user token 사용.
  //
  // 동작:
  // - getSession() 비동기 호출 (메모리 캐시된 session 이므로 ~1ms)
  // - access_token 있으면 realtime.setAuth() → 다음 reconnect 부터 user token
  // - 첫 connection race 는 accessTokenFn fallback 으로 처리 (이제 _client 존재)
  //
  // 근거: Supabase 공식 가이드 (Realtime Authorization)
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token) {
        _client!.realtime.setAuth(session.access_token);
      }
    } catch {
      // session fetch 실패 시 anon fallback 유지 (RLS 정책이 차단)
    }
  })();

  return _client;
}
