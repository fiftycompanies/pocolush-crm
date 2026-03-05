'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import TypeBadge from '@/components/inquiries/TypeBadge';
import StatusBadge from '@/components/inquiries/StatusBadge';
import type { Customer, Inquiry } from '@/types';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [custRes, inqRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase
          .from('inquiries')
          .select('*, assignee:profiles(*)')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ]);
      if (custRes.data) setCustomer(custRes.data);
      if (inqRes.data) setInquiries(inqRes.data);
    };
    fetchData();
  }, [id, supabase]);

  if (!customer) {
    return <div className="text-center py-20 text-text-muted">불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <button
        onClick={() => router.back()}
        className="text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        ← 목록으로
      </button>

      {/* Customer card */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xl font-bold">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{customer.name}</h1>
            <p className="text-sm text-text-secondary">{customer.phone}</p>
            <p className="text-xs text-text-muted mt-1">
              가입일: {format(new Date(customer.created_at), 'yyyy년 M월 d일', { locale: ko })}
            </p>
          </div>
        </div>
      </div>

      {/* Inquiry history */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text-secondary">
            문의 내역 ({inquiries.length}건)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">유형</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">상태</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">담당자</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">접수일</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-muted text-sm">
                    문의 내역이 없습니다
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr
                    key={inq.id}
                    onClick={() => router.push(`/dashboard/inquiries/${inq.id}`)}
                    className="border-b border-border/50 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <TypeBadge type={inq.type} />
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={inq.status} />
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {inq.assignee?.name || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted">
                      {format(new Date(inq.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
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
