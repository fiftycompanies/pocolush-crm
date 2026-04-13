'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { RENTAL_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { FileText, Search } from 'lucide-react';
import { useRentals } from '@/lib/use-data';
import ExportButton from '@/components/ui/ExportButton';

const tabs = [
  { value: '', label: '전체' },
  { value: 'active', label: '임대중' },
  { value: 'expired', label: '만료' },
  { value: 'cancelled', label: '취소' },
];

export default function RentalsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');

  const { data: rentals } = useRentals(tab || undefined);

  const filtered = search
    ? rentals.filter((r) =>
        r.customer?.name?.includes(search) || r.customer?.phone?.includes(search)
      )
    : rentals;

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">임대 계약</h1>
          <p className="text-[14px] text-text-secondary mt-0.5">전체 {filtered.length}건</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="rentals" params={{ status: tab, search }} />
          <Button onClick={() => router.push('/dashboard/rentals/new')} variant="primary">
            + 새 계약 등록
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            placeholder="고객 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl pl-9 pr-3.5 py-2.5 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">농장</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">고객명</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">연락처</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">플랜</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">기간</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">월 결제액</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">결제</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={FileText} title="임대 계약이 없습니다" />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const statusMeta = RENTAL_STATUS[r.status] || RENTAL_STATUS.active;
                  const payMeta = PAYMENT_STATUS[r.payment_status];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/dashboard/rentals/${r.id}`)}
                      className="border-b border-border-light hover:bg-bg-hover cursor-pointer transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 text-[14px] text-primary font-bold">{r.farm?.number}번</td>
                      <td className="px-5 py-3.5 text-[14px] text-text-primary font-medium">{r.customer?.name}</td>
                      <td className="px-5 py-3.5 text-[14px] text-text-secondary">{r.customer?.phone}</td>
                      <td className="px-5 py-3.5 text-[14px] text-text-secondary">{r.plan || '-'}</td>
                      <td className="px-5 py-3.5 text-[14px] text-text-tertiary">
                        {format(new Date(r.start_date), 'yy.M.d')} ~ {format(new Date(r.end_date), 'yy.M.d')}
                      </td>
                      <td className="px-5 py-3.5 text-[14px] text-primary font-semibold">{r.monthly_fee.toLocaleString()}원</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          label={`${r.payment_method} · ${r.payment_status}`}
                          color={payMeta?.color || '#6B7280'}
                          bg={payMeta?.bg}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
