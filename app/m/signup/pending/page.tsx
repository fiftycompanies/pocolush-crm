'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPendingPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/m/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px] text-center">
        <div className="text-[56px] mb-6">⏳</div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-3">
          승인 대기 중
        </h1>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-2">
          회원가입이 접수되었습니다.
        </p>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-8">
          관리자 승인 후 이용 가능합니다.<br />
          승인 완료 시 알림을 드리겠습니다.
        </p>

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-[#FFFBEB] flex items-center justify-center text-lg">
              📞
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">문의</p>
              <p className="text-xs text-text-secondary">카카오채널 @포코러쉬</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-text-secondary text-[13px] hover:text-text-primary transition-colors underline"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
