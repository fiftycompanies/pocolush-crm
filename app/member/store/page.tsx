'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ORDER_STATUS, COUPON_STATUS, PRODUCT_CATEGORIES } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { StoreProduct, ServiceOrder, Coupon, CouponIssue, Member } from '@/types';

export default function MemberStorePage() {
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [recentOrders, setRecentOrders] = useState<(ServiceOrder & { product?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from('members').select('*').eq('user_id', user.id).maybeSingle();
      setMember(m);

      const { data: p } = await supabase.from('store_products').select('*').eq('is_active', true).order('sort_order');
      setProducts(p || []);

      const today = new Date().toISOString().split('T')[0];
      const { data: c } = await supabase.from('coupons').select('*')
        .eq('is_active', true)
        .or(`valid_until.is.null,valid_until.gte.${today}`);
      setCoupons(c || []);

      if (m) {
        const { data: o } = await supabase.from('service_orders').select('*, product:store_products(name)')
          .eq('member_id', m.id).order('created_at', { ascending: false }).limit(3);
        setRecentOrders(o || []);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleOrder = async (product: StoreProduct) => {
    if (!member) return;
    setSubmitting(product.id);
    const { error } = await supabase.from('service_orders').insert({
      member_id: member.id, product_id: product.id, total_price: product.price,
    });
    if (error) toast.error('신청에 실패했습니다.');
    else {
      toast.success(`${product.name} 신청 완료!`);
      const { data: o } = await supabase.from('service_orders').select('*, product:store_products(name)')
        .eq('member_id', member.id).order('created_at', { ascending: false }).limit(3);
      setRecentOrders(o || []);
    }
    setSubmitting(null);
  };

  const handleCouponRequest = async (coupon: Coupon) => {
    if (!member) return;
    setSubmitting(coupon.id);

    // max_issues 체크
    if (coupon.max_issues) {
      const { count } = await supabase
        .from('coupon_issues')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id);
      if ((count || 0) >= coupon.max_issues) {
        toast.error('쿠폰 발급 수량이 소진되었습니다.');
        setSubmitting(null);
        return;
      }
    }

    // 동일 회원 중복 발급 체크
    const { data: existing } = await supabase
      .from('coupon_issues')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('member_id', member.id)
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error('이미 발급받은 쿠폰입니다.');
      setSubmitting(null);
      return;
    }

    const { data: code } = await supabase.rpc('generate_coupon_code');
    if (!code) { toast.error('쿠폰 코드 생성 실패'); setSubmitting(null); return; }
    const { error } = await supabase.from('coupon_issues').insert({
      coupon_id: coupon.id, member_id: member.id, coupon_code: code,
    });
    if (error) toast.error('쿠폰 요청에 실패했습니다.');
    else toast.success('쿠폰이 발급되었습니다! 쿠폰함에서 확인하세요.');
    setSubmitting(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-text-primary">스토어</h1>

      {/* 농장 관리 서비스 */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">농장 관리 서비스</h3>
        <div className="space-y-2.5">
          {products.map(p => {
            const cat = PRODUCT_CATEGORIES[p.category];
            return (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cat?.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.name}</p>
                    <p className="text-[11px] text-text-tertiary">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{p.price.toLocaleString()}원</span>
                  <button onClick={() => handleOrder(p)} disabled={submitting === p.id}
                    className="px-3 py-1.5 text-xs font-medium bg-[#16A34A] text-white rounded-lg hover:bg-[#15803D] disabled:opacity-40">
                    {submitting === p.id ? '...' : '신청'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 회원 혜택 쿠폰 */}
      {coupons.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">회원 혜택 쿠폰</h3>
          <div className="space-y-2.5">
            {coupons.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{c.name}</p>
                  <p className="text-[11px] text-text-tertiary">{c.description}</p>
                </div>
                <button onClick={() => handleCouponRequest(c)} disabled={submitting === c.id}
                  className="px-3 py-1.5 text-xs font-medium bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] disabled:opacity-40">
                  {submitting === c.id ? '...' : '쿠폰요청'}
                </button>
              </div>
            ))}
          </div>
          <Link href="/member/store/coupons" className="flex items-center justify-center gap-0.5 mt-3 text-[12px] text-text-tertiary hover:text-text-primary">
            내 쿠폰함 보기 <ChevronRight className="size-3" />
          </Link>
        </div>
      )}

      {/* 최근 신청 내역 */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">신청 내역</h3>
          <Link href="/member/store/orders" className="text-[12px] text-text-tertiary hover:text-text-primary flex items-center gap-0.5">
            전체보기 <ChevronRight className="size-3" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-2">신청 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(o => {
              const status = ORDER_STATUS[o.status];
              return (
                <div key={o.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm text-text-primary">{o.product?.name}</p>
                    <p className="text-[11px] text-text-tertiary">{new Date(o.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>
                    {status?.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
