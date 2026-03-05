'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Badge from '@/components/ui/Badge';
import { INQUIRY_TYPES, INQUIRY_STATUS } from '@/lib/constants';
import type { Inquiry } from '@/types';

export default function RecentInquiries() {
  const supabase = createClient();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('inquiries')
        .select('*, customer:customers(*)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setInquiries(data);
    };
    fetchRecent();
  }, [supabase]);

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-medium text-text-secondary">최근 문의</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">유형</th>
              <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">이름</th>
              <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">연락처</th>
              <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">상태</th>
              <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">접수일</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-sm">
                  문의 데이터가 없습니다
                </td>
              </tr>
            ) : (
              inquiries.map((inq) => {
                const typeMeta = INQUIRY_TYPES[inq.type] || {
                  label: inq.type,
                  color: '#6B7280',
                  emoji: '📋',
                };
                const statusMeta = INQUIRY_STATUS[inq.status] || INQUIRY_STATUS.new;

                return (
                  <tr
                    key={inq.id}
                    onClick={() => router.push(`/dashboard/inquiries?open=${inq.id}`)}
                    className="border-b border-border/50 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Badge
                        label={`${typeMeta.emoji} ${typeMeta.label}`}
                        color={typeMeta.color}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-text-primary">
                      {inq.customer?.name || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {inq.customer?.phone || '-'}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        label={statusMeta.label}
                        color={statusMeta.color}
                        bg={statusMeta.bg}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-text-muted">
                      {format(new Date(inq.created_at), 'M/d HH:mm', { locale: ko })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
