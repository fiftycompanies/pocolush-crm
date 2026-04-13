'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/m/reset-password`,
    });

    if (error) {
      toast.error('이메일 발송에 실패했습니다.');
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-[380px] text-center">
          <div className="text-[56px] mb-6">📧</div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-3">
            이메일을 확인하세요
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-8">
            <span className="font-medium text-text-primary">{email}</span>으로<br />
            비밀번호 재설정 링크를 발송했습니다.
          </p>
          <Link href="/m/login" className="text-[#16A34A] text-sm font-medium hover:underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">비밀번호 찾기</h1>
          <p className="text-[14px] text-text-secondary mt-2">가입한 이메일을 입력하시면 재설정 링크를 보내드립니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="이메일"
            className="w-full border border-border rounded-xl px-4 py-3.5 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10"
          />
          <button type="submit" disabled={loading}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] rounded-xl h-12 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2">
            {loading ? '발송 중...' : '재설정 링크 발송'}
          </button>
        </form>

        <p className="text-center mt-6">
          <Link href="/m/login" className="text-text-secondary text-[13px] hover:text-text-primary transition-colors">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
