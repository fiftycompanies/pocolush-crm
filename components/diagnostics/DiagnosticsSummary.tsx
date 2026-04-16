import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import MonthlyChart from './MonthlyChart';
import type { TriggerErrorMonthlySummary } from '@/types';

interface Props {
  rows: TriggerErrorMonthlySummary[];
  unackedTotal: number;
}

export default function DiagnosticsSummary({ rows, unackedTotal }: Props) {
  // rows is desc by month; first = current month
  const current = rows[0];
  const previous = rows[1];

  const currentTotal = current ? Number(current.total_count) : 0;
  const previousTotal = previous ? Number(previous.total_count) : 0;

  const cards = [
    {
      label: '이번 달',
      value: currentTotal,
      sub: current?.top_function ? `최다: ${current.top_function}` : '',
      color: currentTotal === 0 ? '#059669' : currentTotal <= 5 ? '#D97706' : '#DC2626',
      bg: currentTotal === 0 ? '#ECFDF5' : currentTotal <= 5 ? '#FFFBEB' : '#FEF2F2',
      icon: currentTotal === 0 ? CheckCircle2 : AlertTriangle,
    },
    {
      label: '지난 달',
      value: previousTotal,
      sub: previous?.top_function ? `최다: ${previous.top_function}` : '',
      color: '#6B7280',
      bg: '#F3F4F6',
      icon: AlertCircle,
    },
    {
      label: '미확인 (전체)',
      value: unackedTotal,
      sub: unackedTotal === 0 ? '문제 없음' : '확인 필요',
      color: unackedTotal === 0 ? '#059669' : unackedTotal <= 5 ? '#D97706' : '#DC2626',
      bg: unackedTotal === 0 ? '#ECFDF5' : unackedTotal <= 5 ? '#FFFBEB' : '#FEF2F2',
      icon: unackedTotal === 0 ? CheckCircle2 : AlertCircle,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="bg-card border rounded-xl p-4 flex items-center gap-3"
            >
              <div
                className="size-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.bg }}
              >
                <Icon className="size-5" style={{ color: c.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] text-text-tertiary">{c.label}</p>
                <p className="text-[20px] font-bold leading-tight" style={{ color: c.color }}>
                  {c.value.toLocaleString()}건
                </p>
                {c.sub && (
                  <p className="text-[11px] text-text-tertiary truncate">{c.sub}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-[14px] font-semibold text-text-primary mb-2">
          최근 6개월 추세
        </h3>
        <MonthlyChart rows={rows} />
      </div>
    </div>
  );
}
