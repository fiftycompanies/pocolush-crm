import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client — singleton + Realtime 401 옵션 5 (2026-05-16)
 *
 * 진단 history (3차 시도 모두 효과 미발현):
 * 1. TopBar setAuth (5361889) — 8건
 * 2. singleton + realtime.accessToken 옵션 (9de7b51) — 16건
 * 3. createBrowserClient 직후 setAuth IIFE (676aaef) — 28건 (오히려 증가)
 *
 * 진짜 원인: WebSocket upgrade 시점 (createBrowserClient 동기 호출 내부)에
 * apikey=anon 만 전달 → upgrade 직후 첫 메시지가 401 거부.
 * setAuth() 는 connection 후 access_token 메시지로 전송됨 (이미 늦음).
 *
 * 옵션 5: 첫 connection 시점부터 user JWT 전달 (3중 적용)
 *   ① localStorage 동기 읽기 → initialToken
 *   ② global.headers.Authorization (REST/HTTP)
 *   ③ realtime.params.access_token (WebSocket URL)
 *   ④ realtime.accessToken + setAuth IIFE 보조 (후속 reconnect)
 *
 * 근거: thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md
 */

const STORAGE_KEY_PREFIX = 'sb-';
const STORAGE_KEY_SUFFIX = '-auth-token';

/**
 * localStorage 에서 동기적으로 access_token 추출.
 * supabase-js v2.98 표준 storage key (v3+ 시 점검 필요).
 */
function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const ref = url.replace(/^https?:\/\//, '').split('.')[0];
    const stored = window.localStorage.getItem(
      `${STORAGE_KEY_PREFIX}${ref}${STORAGE_KEY_SUFFIX}`,
    );
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

// Wrapper 함수 — ReturnType 추론 정확화 (use-member-detail strict TS 호환)
const _make = (url: string, key: string, initialToken: string | null) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    realtime: {
      // 후속 reconnect 대응 (singleton 으로 한 번만 호출)
      accessToken: accessTokenFn,
      params: initialToken
        ? { apikey: key, access_token: initialToken }
        : { apikey: key },
    },
  };
  if (initialToken) {
    // REST/HTTP 첫 요청부터 user JWT 전달
    opts.global = {
      headers: { Authorization: `Bearer ${initialToken}` },
    };
  }
  return createBrowserClient(url, key, opts);
};

type BrowserClient = ReturnType<typeof _make>;
let _client: BrowserClient | null = null;

async function accessTokenFn(): Promise<string | null> {
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
    // Build-time placeholder — singleton 캐싱 안 함
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
    );
  }

  // 옵션 5: 첫 connection 시점부터 JWT 전달
  const initialToken = getInitialToken();
  _client = _make(url, key, initialToken);

  // 보조 안전망: 로그인 직후 (localStorage 비어있는 경우) IIFE 로 setAuth
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token) {
        _client!.realtime.setAuth(session.access_token);
      }
    } catch {
      // session fetch 실패 시 anon fallback
    }
  })();

  return _client;
}
