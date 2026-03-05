'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { format, subDays } from 'date-fns';
import type { DailyCount } from '@/types';

export default function InquiryLineChart() {
  const supabase = createClient();
  const [data, setData] = useState<DailyCount[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const days = 30;
      const startDate = subDays(new Date(), days);

      const { data: inquiries } = await supabase
        .from('inquiries')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Group by date
      const countMap: Record<string, number> = {};
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'MM/dd');
        countMap[date] = 0;
      }

      inquiries?.forEach((inq) => {
        const date = format(new Date(inq.created_at), 'MM/dd');
        if (countMap[date] !== undefined) {
          countMap[date]++;
        }
      });

      setData(
        Object.entries(countMap).map(([date, count]) => ({ date, count }))
      );
    };

    fetchData();
  }, [supabase]);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        최근 30일 문의 추이
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3D2E" />
            <XAxis
              dataKey="date"
              stroke="#6B6B65"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#6B6B65"
              fontSize={11}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A2E1E',
                border: '1px solid #2A3D2E',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#F0EDE6',
              }}
              labelStyle={{ color: '#A0A09A' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#E8A045"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#E8A045' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
