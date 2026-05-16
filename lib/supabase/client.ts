import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client — singleton + Realtime 401 옵션 7 (2026-05-16)
 *
 * 진단 history (6차 시도):
 *   1. TopBar setAuth (5361889) — 8건
 *   2. singleton + realtime.accessToken (9de7b51) — 16건
 *   3. createBrowserClient 직후 setAuth IIFE (676aaef) — 28건 (역효과)
 *   4. localStorage + global.headers + realtime.params (97d4a72) — 3건 (89%↓)
 *   5. cookie + localStorage + global.headers + realtime.params (5cde1b3) — 6건
 *      ↳ 진단: socketerror = "HTTP Authentication failed; no valid credentials"
 *      ↳ URL 에 apikey(anon) + access_token(user) 동시 전달 → Supabase Realtime 서버 충돌
 *      ↳ realtime-js 표준 흐름: URL=apikey, phx_join payload=access_token
 *
 * **옵션 7 (현재)** — 6차 시도:
 *   ① document.cookie 동기 파싱 → `sb-<ref>-auth-token` 추출 (옵션 6 유지)
 *   ② localStorage 동기 fallback (hybrid 환경 대응)
 *   ③ global.headers.Authorization (REST/HTTP 첫 요청 — WebSocket 무영향)
 *   ④ realtime.params 에서 access_token 제거 (apikey 만 — realtime-js 표준)
 *   ⑤ IIFE setAuth(initialToken) 동기 호출 — channel join 전 user JWT 보장
 *   ⑥ realtime.accessToken 콜백 (후속 reconnect)
 *
 * 영향 분석 (검수 완료):
 *   - 본 파일 단일 변경 (lib/supabase/server.ts, middleware.ts 별개 createServerClient)
 *   - 회원 측 /m/* + 어드민 /dashboard/* 동일 createClient() — 동일 흐름
 *   - signIn/signOut/인증 흐름 변경 0 (cookie 읽기 전용)
 *   - SSR 안전 (typeof document/window 가드)
 *   - 모든 분기 fallback null → 기존 anon 폴백 (회귀 0)
 *   - realtime-js 표준 흐름 복귀로 Supabase 서버 인증 충돌 해소
 *
 * 근거: thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md
 *       @supabase/ssr 0.9.0 cookies.js (base64- prefix + base64url + chunked)
 *       @supabase/realtime-js RealtimeClient (URL apikey + phx_join access_token)
 */

/**
 * @supabase/ssr cookies.js 의 base64url decoder 동등 구현 (브라우저 atob 사용)
 */
function decodeBase64URL(s: string): string {
  // base64url → base64 (atob 호환)
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  return atob(padded);
}

/**
 * document.cookie 동기 파싱 (옵션 6 핵심).
 * `sb-<ref>-auth-token` (또는 chunked `.0`, `.1`, ...) 에서 access_token 추출.
 */
function getInitialTokenFromCookie(ref: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const base = `sb-${ref}-auth-token`;
    const cookies = document.cookie.split(';').map((c) => c.trim());

    const chunks: Array<{ name: string; value: string }> = [];
    for (const c of cookies) {
      const eq = c.indexOf('=');
      if (eq === -1) continue;
      const name = c.slice(0, eq);
      const rest = c.slice(eq + 1);
      // base 일치 또는 .숫자 chunked
      if (
        name === base ||
        (name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1)))
      ) {
        chunks.push({ name, value: rest });
      }
    }
    if (chunks.length === 0) return null;

    // .0, .1, .2 ... 순서 보장
    chunks.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    let combined = chunks.map((c) => decodeURIComponent(c.value)).join('');

    // base64- prefix 처리 (@supabase/ssr cookieEncoding: 'base64url' 기본값)
    if (combined.startsWith('base64-')) {
      combined = decodeBase64URL(combined.slice('base64-'.length));
    }

    const parsed = JSON.parse(combined);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * localStorage 동기 폴백 (옵션 5 유지 — supabase-js standalone 환경 대응).
 */
function getInitialTokenFromLocalStorage(ref: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * cookie 우선, localStorage 폴백 — 첫 connection 부터 user JWT 확보.
 */
function getInitialToken(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  return getInitialTokenFromCookie(ref) ?? getInitialTokenFromLocalStorage(ref);
}

// ─── Wrapper (ReturnType 추론 유지 — use-member-detail strict TS 호환) ─────
const _make = (url: string, key: string, initialToken: string | null) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    realtime: {
      // 후속 reconnect 대응 (singleton 한 번만 호출)
      accessToken: accessTokenFn,
      // 옵션 7: realtime-js 표준 — URL 은 apikey 만, channel join 시 access_token
      // (URL 에 access_token 동시 전달 시 "HTTP Authentication failed" 충돌)
      params: { apikey: key },
    },
  };
  if (initialToken) {
    // REST/HTTP 첫 요청부터 user JWT 전달 (WebSocket 무영향)
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

  // 옵션 7: cookie → localStorage 동기 추출 → IIFE setAuth 즉시 호출
  const initialToken = getInitialToken();
  _client = _make(url, key, initialToken);

  // 핵심: 동기 추출된 token 즉시 setAuth → channel join 전 accessTokenValue 보장
  if (initialToken) {
    try {
      _client.realtime.setAuth(initialToken);
    } catch {
      // setAuth 실패 시 후속 IIFE 가 보조
    }
  }

  // 보조 안전망: cookie/localStorage 둘 다 비어있는 경우 (로그인 직후 race)
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token && session.access_token !== initialToken) {
        _client!.realtime.setAuth(session.access_token);
      }
    } catch {
      // session fetch 실패 시 anon fallback
    }
  })();

  return _client;
}
