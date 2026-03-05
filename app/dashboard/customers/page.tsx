'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  inquiry_count: number;
  last_inquiry_at: string | null;
}

export default function CustomersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data: custs } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!custs) return;

      // Get inquiry counts for each customer
      const rows: CustomerRow[] = await Promise.all(
        custs.map(async (c) => {
          const { count } = await supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', c.id);

          const { data: latest } = await supabase
            .from('inquiries')
            .select('created_at')
            .eq('customer_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...c,
            inquiry_count: count ?? 0,
            last_inquiry_at: latest?.created_at || null,
          };
        })
      );

      setCustomers(rows);
    };

    fetchCustomers();
  }, [supabase]);

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      )
    : customers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">고객 관리</h1>
        <p className="text-sm text-text-muted mt-1">전체 {filtered.length}명</p>
      </div>

      <input
        type="text"
        placeholder="이름·연락처 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors w-64"
      />

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">이름</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">연락처</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">총 문의수</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">첫 접촉일</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">최근 접촉일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-text-muted text-sm">
                    고객 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/dashboard/customers/${c.id}`)}
                    className="border-b border-border/50 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-sm text-text-primary font-medium">{c.name}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{c.phone}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="text-gold font-medium">{c.inquiry_count}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted">
                      {format(new Date(c.created_at), 'yyyy.M.d', { locale: ko })}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted">
                      {c.last_inquiry_at
                        ? format(new Date(c.last_inquiry_at), 'yyyy.M.d', { locale: ko })
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
