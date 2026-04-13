'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import { useChartData } from '@/lib/use-data';

export default function InquiryLineChart() {
  const { data } = useChartData();

  return (
    <Card>
      <div className="px-6">
        <h3 className="text-sm font-semibold leading-none">
          최근 30일 문의 추이
        </h3>
        <p className="text-xs text-muted-foreground mt-1">일별 문의 접수 건수</p>
      </div>
      <div className="px-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0 0)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="oklch(0.65 0 0)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.65 0 0)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(1 0 0)',
                border: '1px solid oklch(0.92 0 0)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'oklch(0.145 0 0)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                padding: '8px 12px',
              }}
              labelStyle={{ color: 'oklch(0.556 0 0)', marginBottom: 4 }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="oklch(0.646 0.222 41.116)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'oklch(0.646 0.222 41.116)', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
