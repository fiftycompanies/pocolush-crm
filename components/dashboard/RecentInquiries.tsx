'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronRight, MessageSquare } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { INQUIRY_TYPES, INQUIRY_STATUS } from '@/lib/constants';
import { useInquiries } from '@/lib/use-data';

export default function RecentInquiries() {
  const router = useRouter();
  const { data: allInquiries } = useInquiries();

  const inquiries = [...allInquiries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return (
    <Card padding={false}>
      <div className="flex items-center justify-between px-6 py-4">
        <h3 className="text-sm font-semibold">최근 문의</h3>
        <button
          onClick={() => router.push('/dashboard/inquiries')}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-all cursor-pointer"
        >
          전체보기
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div>
        {inquiries.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="문의 데이터가 없습니다"
            description="홈페이지에서 문의가 접수되면 여기에 표시됩니다"
          />
        ) : (
          inquiries.map((inq, i) => {
            const typeMeta = INQUIRY_TYPES[inq.type] || { label: inq.type, color: '#6B7280', emoji: '' };
            const statusMeta = INQUIRY_STATUS[inq.status] || INQUIRY_STATUS.new;

            return (
              <div
                key={inq.id}
                onClick={() => router.push(`/dashboard/inquiries?open=${inq.id}`)}
                className={`flex items-center gap-3 px-6 py-3 hover:bg-muted/20 cursor-pointer transition-all ${
                  i > 0 ? 'border-t border-border/40' : ''
                }`}
              >
                <Badge label={typeMeta.label} color={typeMeta.color} />
                <span className="text-sm font-medium truncate">
                  {inq.customer?.name || '-'}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {inq.customer?.phone || '-'}
                </span>
                <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                  {formatDistanceToNow(new Date(inq.created_at), { addSuffix: true, locale: ko })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
