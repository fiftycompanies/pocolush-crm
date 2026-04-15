'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Map, ShoppingBag, Flame, Ticket, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { FARM_STATUS, INQUIRY_STATUS } from '@/lib/constants';
import { ORDER_STATUS, RESERVATION_STATUS, COUPON_STATUS } from '@/lib/member-constants';
import Badge from '@/components/ui/Badge';
import type { Farm, FarmZone } from '@/types';

const TABS = [
  { key: 'farms', label: '농장현황', icon: Map },
  { key: 'requests', label: '신청관리', icon: ShoppingBag },
  { key: 'inquiries', label: '문의관리', icon: MessageSquare },
] as const;

interface RequestItem {
  id: string;
  type: 'bbq' | 'order' | 'coupon';
  name: string;
  detail: string;
  date: string;
  status: string;
  statusMeta: { label: string; color: string; bg: string };
  link: string;
}

export default function DashboardList() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<string>('farms');

  // 농장
  const [farms, setFarms] = useState<(Farm & { zone?: FarmZone })[]>([]);
  // 통합 신청
  const [requests, setRequests] = useState<RequestItem[]>([]);
  // 문의
  const [inquiries, setInquiries] = useState<{ id: string; type: string; customer_name: string; phone: string; date: string; status: string; statusMeta: { label: string; color: string; bg: string } }[]>([]);
  const [loading, setLoading] = useState(true);

  const INQUIRY_TYPES: Record<string, string> = {
    jaramter_inquiry: '자람터 분양',
    janchimaru_consult: '잔치마루',
    campnic_notify: '캠프닉',
    kids_notify: '키즈놀이터',
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [farmsRes, zonesRes, rentalsRes, bbqRes, ordersRes, couponsRes, inqRes] = await Promise.all([
      supabase.from('farms').select('*').order('number'),
      supabase.from('farm_zones').select('*').order('sort_order'),
      supabase.from('farm_rentals').select('*, customer:customers(name, phone)').eq('status', 'active'),
      supabase.from('bbq_reservations').select('*, member:members(name)').eq('status', 'confirmed').gte('reservation_date', today).order('reservation_date').limit(20),
      supabase.from('service_orders').select('*, member:members(name), product:store_products(name)').in('status', ['pending', 'processing']).order('created_at', { ascending: false }).limit(20),
      supabase.from('coupon_issues').select('*, member:members(name), coupon:coupons(name)').eq('status', 'issued').order('created_at', { ascending: false }).limit(20),
      supabase.from('inquiries').select('*, customer:customers(name, phone)').in('status', ['new', 'contacted']).order('created_at', { ascending: false }).limit(20),
    ]);

    // 농장 enrichment
    const zoneMap: Record<string, FarmZone> = {};
    (zonesRes.data || []).forEach((z: FarmZone) => { zoneMap[z.id] = z; });
    const enrichedFarms = (farmsRes.data || []).map((f: Farm) => {
      const rental = (rentalsRes.data || []).find((r: { farm_id: string }) => r.farm_id === f.id);
      return { ...f, zone: zoneMap[f.zone_id], current_rental: rental || undefined };
    });
    setFarms(enrichedFarms);

    // 통합 신청 리스트
    const reqs: RequestItem[] = [];
    (bbqRes.data || []).forEach((b: { id: string; member?: { name: string }; bbq_number: number; reservation_date: string; time_slot: number; status: string }) => {
      const st = RESERVATION_STATUS[b.status as keyof typeof RESERVATION_STATUS];
      reqs.push({
        id: b.id, type: 'bbq', name: b.member?.name || '-',
        detail: `${b.bbq_number}번 바베큐 · ${b.reservation_date}`,
        date: b.reservation_date, status: b.status,
        statusMeta: st || { label: b.status, color: '#6B7280', bg: '#F3F4F6' },
        link: '/dashboard/requests?type=bbq',
      });
    });
    (ordersRes.data || []).forEach((o: { id: string; member?: { name: string }; product?: { name: string }; created_at: string; status: string }) => {
      const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
      reqs.push({
        id: o.id, type: 'order', name: o.member?.name || '-',
        detail: o.product?.name || '서비스',
        date: o.created_at, status: o.status,
        statusMeta: st || { label: o.status, color: '#6B7280', bg: '#F3F4F6' },
        link: '/dashboard/requests?type=order',
      });
    });
    (couponsRes.data || []).forEach((c: { id: string; member?: { name: string }; coupon?: { name: string }; created_at: string; status: string }) => {
      const st = COUPON_STATUS[c.status as keyof typeof COUPON_STATUS];
      reqs.push({
        id: c.id, type: 'coupon', name: c.member?.name || '-',
        detail: c.coupon?.name || '쿠폰',
        date: c.created_at, status: c.status,
        statusMeta: st || { label: c.status, color: '#6B7280', bg: '#F3F4F6' },
        link: '/dashboard/requests?type=coupon',
      });
    });
    reqs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRequests(reqs);

    // 문의
    const inqs = (inqRes.data || []).map((i: { id: string; type: string; customer?: { name: string; phone: string }; created_at: string; status: string }) => {
      const st = INQUIRY_STATUS[i.status as keyof typeof INQUIRY_STATUS];
      return {
        id: i.id, type: i.type,
        customer_name: i.customer?.name || '-',
        phone: i.customer?.phone || '-',
        date: i.created_at, status: i.status,
        statusMeta: st || { label: i.status, color: '#6B7280', bg: '#F3F4F6' },
      };
    });
    setInquiries(inqs);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TYPE_ICONS = {
    bbq: { icon: Flame, color: '#DC2626', label: 'BBQ' },
    order: { icon: ShoppingBag, color: '#D97706', label: '스토어' },
    coupon: { icon: Ticket, color: '#8B5CF6', label: '쿠폰' },
  };

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-border">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium relative ${
                tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'
              }`}>
              <Icon className="size-3.5" />
              {t.label}
              {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-text-secondary">불러오는 중...</div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto">
          {/* 농장현황 */}
          {tab === 'farms' && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card"><tr className="border-b text-left">
                <th className="px-4 py-2.5 font-medium text-text-secondary">존/사이트</th>
                <th className="px-4 py-2.5 font-medium text-text-secondary">임차인</th>
                <th className="px-4 py-2.5 font-medium text-text-secondary">기간</th>
                <th className="px-4 py-2.5 font-medium text-text-secondary">결제</th>
                <th className="px-4 py-2.5 font-medium text-text-secondary">상태</th>
              </tr></thead>
              <tbody>
                {farms.map(f => {
                  const rental = f.current_rental;
                  const st = FARM_STATUS[f.status] || FARM_STATUS.available;
                  return (
                    <tr key={f.id} onClick={() => router.push('/dashboard/farms')}
                      className="border-b border-border/40 last:border-0 hover:bg-accent/30 cursor-pointer">
                      <td className="px-4 py-2.5 font-medium">{f.zone?.name || ''} {f.number}번</td>
                      <td className="px-4 py-2.5">{rental?.customer?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">
                        {rental ? `${format(new Date(rental.start_date), 'yy.M.d')} ~ ${format(new Date(rental.end_date), 'yy.M.d')}` : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        {rental ? (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            rental.payment_status === '납부완료' ? 'text-green bg-green-light' :
                            rental.payment_status === '미납' ? 'text-red bg-red-light' : 'text-yellow bg-yellow-light'
                          }`}>{rental.payment_status}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2.5"><Badge label={st.label} color={st.color} bg={st.bg} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 신청관리 (통합) */}
          {tab === 'requests' && (
            requests.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-tertiary">미처리 신청이 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card"><tr className="border-b text-left">
                  <th className="px-4 py-2.5 font-medium text-text-secondary">구분</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">신청자</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">내용</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">날짜</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">상태</th>
                </tr></thead>
                <tbody>
                  {requests.map(r => {
                    const tc = TYPE_ICONS[r.type];
                    const Icon = tc.icon;
                    return (
                      <tr key={r.id + r.type} onClick={() => router.push(r.link)}
                        className="border-b border-border/40 last:border-0 hover:bg-accent/30 cursor-pointer">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3.5" style={{ color: tc.color }} />
                            <span className="text-xs font-medium" style={{ color: tc.color }}>{tc.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{r.detail}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary">{format(new Date(r.date), 'M.d')}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ color: r.statusMeta.color, backgroundColor: r.statusMeta.bg }}>
                            {r.statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* 문의관리 */}
          {tab === 'inquiries' && (
            inquiries.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-tertiary">미처리 문의가 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card"><tr className="border-b text-left">
                  <th className="px-4 py-2.5 font-medium text-text-secondary">유형</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">고객명</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">연락처</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">날짜</th>
                  <th className="px-4 py-2.5 font-medium text-text-secondary">상태</th>
                </tr></thead>
                <tbody>
                  {inquiries.map(i => (
                    <tr key={i.id} onClick={() => router.push(`/dashboard/inquiries/${i.id}`)}
                      className="border-b border-border/40 last:border-0 hover:bg-accent/30 cursor-pointer">
                      <td className="px-4 py-2.5 font-medium">{INQUIRY_TYPES[i.type] || i.type}</td>
                      <td className="px-4 py-2.5">{i.customer_name}</td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs">{i.phone}</td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">{format(new Date(i.date), 'M.d')}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ color: i.statusMeta.color, backgroundColor: i.statusMeta.bg }}>
                          {i.statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
