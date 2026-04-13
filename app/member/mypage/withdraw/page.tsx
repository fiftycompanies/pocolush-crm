'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function WithdrawPage() {
  const router = useRouter();
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from('members').select('id, withdrawal_requested_at').eq('user_id', user.id).maybeSingle();
      if (m) {
        setMemberId(m.id);
        if (m.withdrawal_requested_at) setAlreadyRequested(true);
      }
    }
    load();
  }, [supabase]);

  const handleSubmit = async () => {
    if (!memberId) return;
    if (!reason.trim()) {
      toast.error('탈퇴 사유를 입력해주세요.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('members').update({
      withdrawal_requested_at: new Date().toISOString(),
      withdrawal_reason: reason.trim(),
    }).eq('id', memberId);

    if (error) {
      toast.error('탈퇴 신청에 실패했습니다.');
    } else {
      toast.success('탈퇴 신청이 접수되었습니다.');
      setAlreadyRequested(true);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary">회원탈퇴 신청</h1>
      </div>

      {alreadyRequested ? (
        <div className="bg-white border border-border rounded-2xl p-6 text-center">
          <div className="text-[40px] mb-4">📋</div>
          <h2 className="text-lg font-bold text-text-primary mb-2">탈퇴 신청이 접수되었습니다</h2>
          <p className="text-sm text-text-secondary">관리자 확인 후 처리됩니다.</p>
        </div>
      ) : (
        <>
          <div className="bg-red-light border border-red/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red mb-2">탈퇴 시 유의사항</h3>
            <ul className="space-y-1.5 text-[13px] text-text-secondary">
              <li>• 탈퇴 신청 후 관리자 확인을 거쳐 처리됩니다.</li>
              <li>• 탈퇴 시 회원 혜택 및 쿠폰이 소멸됩니다.</li>
              <li>• 진행 중인 예약이 있는 경우 먼저 취소해주세요.</li>
              <li>• 개인정보는 탈퇴 처리 즉시 파기됩니다.</li>
            </ul>
          </div>

          <div className="bg-white border border-border rounded-2xl p-5">
            <label className="block text-sm font-medium text-text-primary mb-2">탈퇴 사유 *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="탈퇴 사유를 입력해주세요..."
              rows={4}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-red/50 focus:ring-2 focus:ring-red/10 resize-none" />
          </div>

          <button onClick={handleSubmit} disabled={loading || !reason.trim()}
            className="w-full bg-red hover:bg-red/90 text-white font-semibold rounded-xl h-12 transition-all disabled:opacity-40">
            {loading ? '처리 중...' : '탈퇴 신청'}
          </button>
        </>
      )}
    </div>
  );
}
