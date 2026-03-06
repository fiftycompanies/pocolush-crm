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
      <h3 className="text-[16px] font-semibold text-text-primary mb-4">
        최근 30일 문의 추이
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#111827',
                boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
              }}
              labelStyle={{ color: '#6B7280' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#16A34A"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#16A34A' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
