'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

interface Rental {
  id: string;
  plan: string;
  start_date: string;
  end_date: string;
  farm: { number: number } | null;
  member: { id: string; name: string; phone: string | null } | null;
  customer: { name: string; phone: string | null } | null;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function IssueMembershipModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 활성 rental 중 해당 farm에 active membership 없는 것만 후보
    supabase
      .from('farm_rentals')
      .select(`
        id, plan, start_date, end_date,
        farm:farms(number),
        member:members!farm_rentals_member_id_fkey(id, name, phone),
        customer:customers(name, phone)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRentals((data as unknown as Rental[]) || []));
  }, [supabase]);

  const filtered = rentals.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.member?.name || '').toLowerCase().includes(q) ||
      (r.customer?.name || '').toLowerCase().includes(q) ||
      (r.member?.phone || '').includes(q) ||
      (r.customer?.phone || '').includes(q)
    );
  });

  const handleIssue = async () => {
    if (!selectedId) return;
    setBusy(true);
    const { error } = await supabase.rpc('issue_membership', { p_rental_id: selectedId });
    setBusy(false);
    if (error) { toast.error('발급 실패: ' + error.message); return; }
    toast.success('회원권이 발급되었습니다');
    onSuccess();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-lg z-50 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold">회원권 신규 발급</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="회원명/전화 검색"
            className="w-full h-10 px-3 border border-border rounded-lg text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-6">활성 계약이 없습니다</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(r => {
                const who = r.member?.name || r.customer?.name || '-';
                const phone = r.member?.phone || r.customer?.phone || '';
                return (
                  <li
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`px-4 py-3 cursor-pointer text-sm ${
                      selectedId === r.id ? 'bg-primary/10' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{who}</span>
                      <span className="text-xs text-text-tertiary">{phone}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {r.plan} · #{r.farm?.number || '?'} · {r.start_date}~{r.end_date}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent"
          >
            취소
          </button>
          <button
            onClick={handleIssue}
            disabled={!selectedId || busy}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? '발급 중...' : '발급'}
          </button>
        </div>
      </div>
    </>
  );
}
