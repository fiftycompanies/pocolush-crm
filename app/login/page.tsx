'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

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
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="font-bold text-2xl text-text-primary tracking-tight">
              POCO
            </span>
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="font-bold text-2xl text-text-primary tracking-tight">
              LUSH
            </span>
          </div>
          <p className="text-text-muted text-sm">관리자 로그인</p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleLogin}
          className="bg-bg-card border border-border rounded-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm text-text-secondary mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-input border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
              placeholder="admin@pocolush.com"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-bg-input border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button type="submit" variant="gold" className="w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          &copy; 2025 POCOLUSH. 내부 관리 시스템.
        </p>
      </div>
    </div>
  );
}
