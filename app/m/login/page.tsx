'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function MemberLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('이메일 또는 비밀번호를 확인해주세요.');
      setLoading(false);
      return;
    }

    // 루트로 전체 리로드 → 미들웨어가 역할 기반 자동 분기
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-1.5 mb-8">
            <span className="text-[28px]">🌱</span>
            <span className="font-bold text-[20px] text-text-primary tracking-tight">
              자람터
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-text-primary leading-tight tracking-tight">
            회원 로그인
          </h1>
          <p className="text-[14px] text-text-secondary mt-2">
            자람터 회원 계정으로 로그인하세요.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="이메일"
            className={`w-full bg-white border ${error ? 'border-red ring-2 ring-red/10' : 'border-border'} rounded-xl px-4 py-3.5 text-[15px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10 transition-all duration-150`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="비밀번호"
            className={`w-full bg-white border ${error ? 'border-red ring-2 ring-red/10' : 'border-border'} rounded-xl px-4 py-3.5 text-[15px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10 transition-all duration-150`}
          />

          {error && (
            <p className="text-red text-[13px] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] rounded-xl h-12 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-xs mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <Link href="/m/forgot-password" className="text-text-secondary text-[13px] hover:text-text-primary transition-colors">
            비밀번호를 잊으셨나요?
          </Link>
          <div className="h-px" />
          <p className="text-text-secondary text-[13px]">
            아직 회원이 아니신가요?{' '}
            <Link href="/m/signup" className="text-[#16A34A] font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>

        <p className="text-center text-text-tertiary text-[12px] mt-10">
          &copy; 2025 POCOLUSH 자람터
        </p>
      </div>
    </div>
  );
}
