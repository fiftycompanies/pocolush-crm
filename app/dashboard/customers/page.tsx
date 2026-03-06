'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Search, Users } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { useCustomers } from '@/lib/use-data';

export default function CustomersPage() {
  const router = useRouter();
  const { data: customers } = useCustomers();
  const [search, setSearch] = useState('');

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      )
    : customers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary">고객 관리</h1>
          <p className="text-[14px] text-text-secondary mt-1">전체 {filtered.length}명</p>
        </div>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="이름·연락처 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-input border border-border-input rounded-[10px] pl-9 pr-3.5 py-2.5 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_#DCFCE7] transition-all"
        />
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-page">
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">이름</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">연락처</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">총 문의수</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">첫 접촉일</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">최근 접촉일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={Users} title="고객 데이터가 없습니다" description="홈페이지에서 문의가 접수되면 자동으로 등록됩니다" />
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/dashboard/customers/${c.id}`)}
                    className="border-b border-[#F3F4F6] hover:bg-bg-page cursor-pointer transition-colors h-[56px]"
                  >
                    <td className="px-4 py-3 text-[14px] text-text-primary font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-[14px] text-text-secondary">{c.phone}</td>
                    <td className="px-4 py-3 text-[14px]">
                      <span className="text-primary font-semibold">{c.inquiry_count}</span>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-text-tertiary">
                      {format(new Date(c.created_at), 'yyyy.M.d', { locale: ko })}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-text-tertiary">
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
