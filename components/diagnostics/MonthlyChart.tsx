'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { TriggerErrorMonthlySummary } from '@/types';

interface Props {
  rows: TriggerErrorMonthlySummary[];
}

export default function MonthlyChart({ rows }: Props) {
  // Reverse chronological → ascending for chart
  const data = [...rows]
    .reverse()
    .map((r) => ({
      label: format(parseISO(r.month), 'yy.M월', { locale: ko }),
      total: Number(r.total_count),
      unacked: Number(r.unacked_count),
    }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[13px] text-text-tertiary">
        최근 6개월 데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
          <YAxis stroke="#6B7280" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
            }}
            formatter={(value, name) => [
              `${value ?? 0}건`,
              name === 'total' ? '전체' : '미확인',
            ]}
          />
          <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="unacked" fill="#DC2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
