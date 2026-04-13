import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // C1: getUser() 사용 (getSession 금지)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ══════════════════════════════════════
  // 고객 인증 라우트 (/m/*)
  // ══════════════════════════════════════
  const memberAuthPages = ['/m/login', '/m/signup', '/m/forgot-password'];
  const isMemberAuthPage = memberAuthPages.some(p => pathname.startsWith(p));
  const isMemberResetPage = pathname.startsWith('/m/reset-password');
  const isMemberPendingPage = pathname.startsWith('/m/signup/pending');
  const isMemberArea = pathname.startsWith('/member');

  // /m/reset-password — 토큰 기반, 인증 상태 무관
  if (isMemberResetPage) {
    return supabaseResponse;
  }

  // 고객 인증 페이지 (로그인/가입/비번찾기) — 이미 로그인한 사용자는 역할별 리다이렉트
  if (isMemberAuthPage && !isMemberPendingPage) {
    if (user) {
      // 어드민인지 먼저 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        // 어드민 → /dashboard로 이동
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/dashboard';
        return NextResponse.redirect(redirectUrl);
      }

      // 고객 회원 확인
      const { data: member } = await supabase
        .from('members')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (member) {
        const redirectUrl = request.nextUrl.clone();
        if (member.status === 'pending') {
          redirectUrl.pathname = '/m/signup/pending';
        } else if (member.status === 'approved') {
          redirectUrl.pathname = '/member';
        } else {
          return supabaseResponse;
        }
        return NextResponse.redirect(redirectUrl);
      }
    }
    return supabaseResponse;
  }

  // /m/signup/pending — 인증 + pending만
  if (isMemberPendingPage) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }
    const { data: member } = await supabase
      .from('members')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (member?.status === 'approved') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/member';
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // /member/* — 인증 + approved만 (어드민은 /dashboard로)
  if (isMemberArea) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }

    // 어드민이면 /dashboard로 보냄
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }

    const { data: member } = await supabase
      .from('members')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }

    if (member.status === 'pending') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/m/signup/pending';
      return NextResponse.redirect(redirectUrl);
    }

    if (member.status !== 'approved') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  }

  // ══════════════════════════════════════
  // 어드민 라우트
  // ══════════════════════════════════════
  if (!user && pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // 로그인한 사용자가 /dashboard 접근 시, 고객이면 /member로 보냄
  if (user && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      // 어드민이 아니면 고객으로 판단
      const { data: member } = await supabase
        .from('members')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
      const redirectUrl = request.nextUrl.clone();
      if (member?.status === 'approved') redirectUrl.pathname = '/member';
      else if (member?.status === 'pending') redirectUrl.pathname = '/m/signup/pending';
      else redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 어드민 로그인 페이지 — 이미 로그인한 사용자 역할별 분기
  if (user && pathname === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const redirectUrl = request.nextUrl.clone();
    if (profile) {
      redirectUrl.pathname = '/dashboard';
    } else {
      // 고객이 /login으로 접근 → /member로 보냄
      const { data: member } = await supabase
        .from('members')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (member?.status === 'approved') redirectUrl.pathname = '/member';
      else if (member?.status === 'pending') redirectUrl.pathname = '/m/signup/pending';
      else redirectUrl.pathname = '/m/login';
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 루트(/) — 로그인 여부 + 역할에 따라 분기
  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone();

    if (!user) {
      // 미인증 → 고객 로그인이 기본 (자람터는 고객용 메인)
      redirectUrl.pathname = '/m/login';
      return NextResponse.redirect(redirectUrl);
    }

    // 인증된 사용자 → 역할 판단
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      redirectUrl.pathname = '/dashboard';
    } else {
      const { data: member } = await supabase
        .from('members')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (member?.status === 'approved') redirectUrl.pathname = '/member';
      else if (member?.status === 'pending') redirectUrl.pathname = '/m/signup/pending';
      else redirectUrl.pathname = '/m/login';
    }
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
