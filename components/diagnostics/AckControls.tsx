'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CheckCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

function friendlyError(message: string | undefined, fallback: string) {
  if (message === 'FORBIDDEN') return '권한이 없습니다';
  return fallback;
}

interface SingleProps {
  id: string;
}

export function AckOneButton({ id }: SingleProps) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  const handleAck = async () => {
    setPending(true);
    const { error } = await supabase.rpc('ack_trigger_error_log', { p_id: id });
    if (error) {
      toast.error(friendlyError(error.message, '확인 처리 중 오류가 발생했습니다'));
    } else {
      toast.success('확인 처리됨');
      startTransition(() => router.refresh());
    }
    setPending(false);
  };

  return (
    <button
      onClick={handleAck}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[12px] text-text-secondary hover:text-primary disabled:opacity-50 transition-colors"
    >
      <Check className="size-3.5" />
      확인
    </button>
  );
}

export function AckAllButton() {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  const handleAckAll = async () => {
    if (!confirm('미확인 에러를 모두 확인 처리할까요?')) return;
    setPending(true);
    const { data, error } = await supabase.rpc('ack_all_trigger_error_logs');
    if (error) {
      toast.error(friendlyError(error.message, '일괄 확인 처리 중 오류가 발생했습니다'));
    } else {
      toast.success(`${data ?? 0}건 확인 처리됨`);
      startTransition(() => router.refresh());
    }
    setPending(false);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleAckAll} disabled={pending}>
      <CheckCheck className="size-3.5" />
      모두 확인
    </Button>
  );
}
