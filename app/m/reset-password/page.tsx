'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase가 URL 해시에서 세션을 복원할 때까지 대기
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error('비밀번호 변경에 실패했습니다.');
    } else {
      toast.success('비밀번호가 변경되었습니다.');
      router.push('/m/login');
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-text-secondary">인증 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">새 비밀번호 설정</h1>
          <p className="text-[14px] text-text-secondary mt-2">새로운 비밀번호를 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="새 비밀번호 (6자 이상)"
            className="w-full border border-border rounded-xl px-4 py-3.5 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
          <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required
            placeholder="비밀번호 확인"
            className="w-full border border-border rounded-xl px-4 py-3.5 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
          <button type="submit" disabled={loading}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] rounded-xl h-12 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2">
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
