'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import TypeBadge from '@/components/inquiries/TypeBadge';
import StatusBadge from '@/components/inquiries/StatusBadge';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { RENTAL_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { MessageSquare, FileText } from 'lucide-react';
import type { Customer, Inquiry, FarmRental } from '@/types';

type RentalRow = FarmRental & { farm: { number: number; name: string } };

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [tab, setTab] = useState('inquiries');

  useEffect(() => {
    const fetchData = async () => {
      const [custRes, inqRes, rentalRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase
          .from('inquiries')
          .select('*, assignee:profiles(*)')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('farm_rentals')
          .select('*, farm:farms(number, name)')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ]);
      if (custRes.data) setCustomer(custRes.data);
      if (inqRes.data) setInquiries(inqRes.data);
      if (rentalRes.data) setRentals(rentalRes.data as RentalRow[]);
    };
    fetchData();
  }, [id, supabase]);

  if (!customer) {
    return <div className="text-center py-20 text-text-tertiary">불러오는 중...</div>;
  }

  const tabItems = [
    { value: 'inquiries', label: '문의 내역', count: inquiries.length },
    { value: 'rentals', label: '임대 계약', count: rentals.length },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        목록으로
      </button>

      {/* Customer card */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center text-primary text-[20px] font-bold">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-text-primary">{customer.name}</h1>
            <p className="text-[14px] text-text-secondary">{customer.phone}</p>
            <p className="text-[12px] text-text-tertiary mt-1">
              가입일: {format(new Date(customer.created_at), 'yyyy년 M월 d일', { locale: ko })}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={tabItems} value={tab} onChange={setTab} />

      {/* Inquiry history */}
      {tab === 'inquiries' && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-page">
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">유형</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">상태</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">담당자</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">접수일</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon={MessageSquare} title="문의 내역이 없습니다" />
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inq) => (
                    <tr
                      key={inq.id}
                      onClick={() => router.push(`/dashboard/inquiries?open=${inq.id}`)}
                      className="border-b border-[#F3F4F6] hover:bg-bg-page cursor-pointer transition-colors h-[56px]"
                    >
                      <td className="px-4 py-3">
                        <TypeBadge type={inq.type} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inq.status} />
                      </td>
                      <td className="px-4 py-3 text-[14px] text-text-secondary">
                        {inq.assignee?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-tertiary">
                        {format(new Date(inq.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rental history */}
      {tab === 'rentals' && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-page">
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">농장</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">기간</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">월 결제액</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">결제</th>
                  <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {rentals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={FileText} title="임대 계약이 없습니다" />
                    </td>
                  </tr>
                ) : (
                  rentals.map((r) => {
                    const statusMeta = RENTAL_STATUS[r.status] || RENTAL_STATUS.active;
                    const payMeta = PAYMENT_STATUS[r.payment_status];
                    return (
                      <tr
                        key={r.id}
                        onClick={() => router.push(`/dashboard/rentals/${r.id}`)}
                        className="border-b border-[#F3F4F6] hover:bg-bg-page cursor-pointer transition-colors h-[56px]"
                      >
                        <td className="px-4 py-3 text-[14px] text-primary font-bold">{r.farm?.number}번 {r.farm?.name}</td>
                        <td className="px-4 py-3 text-[14px] text-text-tertiary">
                          {format(new Date(r.start_date), 'yy.M.d')} ~ {format(new Date(r.end_date), 'yy.M.d')}
                        </td>
                        <td className="px-4 py-3 text-[14px] text-primary font-semibold">{r.monthly_fee.toLocaleString()}원</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={`${r.payment_method} · ${r.payment_status}`}
                            color={payMeta?.color || '#6B7280'}
                            bg={payMeta?.bg}
                          />
                        </td>
                        <td className="px-4 py-3">
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
      )}
    </div>
  );
}
