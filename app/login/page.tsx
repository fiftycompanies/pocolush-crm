'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
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

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-center gap-1.5 mb-8">
            <span className="font-bold text-[18px] text-text-primary tracking-tight">
              POCOLUSH
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="font-bold text-[18px] text-text-primary tracking-tight">
              CRM
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-text-primary leading-tight">
            안녕하세요.
          </h1>
          <p className="text-[14px] text-text-secondary mt-2">
            관리자 계정으로 로그인하세요.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="이메일"
            className={`w-full bg-bg-input border ${error ? 'border-red' : 'border-border'} rounded-xl px-4 py-3.5 text-[15px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_#DCFCE7] transition-all`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="비밀번호"
            className={`w-full bg-bg-input border ${error ? 'border-red' : 'border-border'} rounded-xl px-4 py-3.5 text-[15px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_#DCFCE7] transition-all`}
          />

          {error && (
            <p className="text-red text-[13px]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold text-[16px] rounded-xl h-[52px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

        <p className="text-center text-text-tertiary text-[12px] mt-8">
          &copy; 2025 POCOLUSH. 내부 관리 시스템.
        </p>
      </div>
    </div>
  );
}
