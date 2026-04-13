'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addMonths, format } from 'date-fns';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { PAYMENT_METHODS, RENTAL_PLANS } from '@/lib/constants';
import type { Farm, Customer } from '@/types';

interface RentalFormProps {
  preselectedFarmId?: string;
  preselectedCustomerId?: string;
}

export default function RentalForm({ preselectedFarmId, preselectedCustomerId }: RentalFormProps) {
  const supabase = createClient();
  const router = useRouter();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState(false);

  const [form, setForm] = useState({
    farm_id: preselectedFarmId || '',
    customer_id: preselectedCustomerId || '',
    new_name: '',
    new_phone: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    plan: '',
    monthly_fee: '',
    payment_method: '계좌이체' as string,
    payment_status: '대기',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [farmsRes, custRes] = await Promise.all([
        supabase.from('farms').select('*').in('status', ['available', 'maintenance']).order('number'),
        supabase.from('customers').select('*').order('name'),
      ]);
      if (preselectedFarmId) {
        const { data: presFarm } = await supabase.from('farms').select('*').eq('id', preselectedFarmId).single();
        if (presFarm && farmsRes.data && !farmsRes.data.find(f => f.id === presFarm.id)) {
          farmsRes.data.unshift(presFarm);
        }
      }
      if (farmsRes.data) setFarms(farmsRes.data);
      if (custRes.data) setCustomers(custRes.data);
    };
    fetchData();
  }, [supabase, preselectedFarmId]);

  const handlePlanSelect = (plan: string) => {
    const planInfo = RENTAL_PLANS[plan];
    setForm({
      ...form,
      plan,
      monthly_fee: planInfo ? String(planInfo.fee) : form.monthly_fee,
    });
  };

  const handleQuickPeriod = (months: number) => {
    if (!form.start_date) return;
    const end = addMonths(new Date(form.start_date), months);
    setForm({ ...form, end_date: format(end, 'yyyy-MM-dd') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let customerId = form.customer_id;

    if (newCustomer) {
      if (!form.new_name || !form.new_phone) {
        toast.error('고객 이름과 연락처를 입력해주세요');
        setSaving(false);
        return;
      }
      const { data: newCust, error } = await supabase
        .from('customers')
        .upsert({ name: form.new_name, phone: form.new_phone }, { onConflict: 'phone' })
        .select()
        .single();
      if (error) {
        toast.error('고객 등록 실패: ' + error.message);
        setSaving(false);
        return;
      }
      customerId = newCust.id;
    }

    if (!form.farm_id || !customerId || !form.start_date || !form.end_date || !form.monthly_fee) {
      toast.error('필수 항목을 모두 입력해주세요');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('farm_rentals').insert({
      farm_id: form.farm_id,
      customer_id: customerId,
      start_date: form.start_date,
      end_date: form.end_date,
      plan: form.plan || null,
      monthly_fee: parseInt(form.monthly_fee),
      payment_method: form.payment_method,
      payment_status: form.payment_status,
      notes: form.notes || null,
    });

    if (error) {
      toast.error('계약 등록 실패: ' + error.message);
    } else {
      toast.success('임대 계약이 등록되었습니다');
      router.push('/dashboard/rentals');
    }
    setSaving(false);
  };

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.name.includes(customerSearch) || c.phone.includes(customerSearch))
    : customers;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Farm select */}
      <Card>
        <h3 className="text-[14px] font-semibold text-text-primary mb-4">농장 선택</h3>
        <Select
          options={farms.map((f) => ({ value: f.id, label: `${f.number}번 — ${f.name} (${f.area_pyeong}평)` }))}
          placeholder="농장을 선택하세요"
          value={form.farm_id}
          onChange={(e) => setForm({ ...form, farm_id: e.target.value })}
          className="w-full"
        />
      </Card>

      {/* Customer */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-text-primary">고객 정보</h3>
          <button
            type="button"
            onClick={() => setNewCustomer(!newCustomer)}
            className="text-[13px] text-primary hover:text-primary-dark transition-colors duration-150 cursor-pointer font-medium"
          >
            {newCustomer ? '기존 고객 검색' : '+ 신규 고객'}
          </button>
        </div>

        {newCustomer ? (
          <div className="space-y-3">
            <Input placeholder="이름" value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} />
            <Input placeholder="연락처" value={form.new_phone} onChange={(e) => setForm({ ...form, new_phone: e.target.value })} />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="이름 / 연락처 검색..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <Select
              options={filteredCustomers.map((c) => ({ value: c.id, label: `${c.name} — ${c.phone}` }))}
              placeholder="고객을 선택하세요"
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              className="w-full"
            />
          </div>
        )}
      </Card>

      {/* Period */}
      <Card>
        <h3 className="text-[14px] font-semibold text-text-primary mb-4">임대 기간</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="시작일" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="종료일" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-3">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleQuickPeriod(m)}
              className="px-3.5 py-2 bg-bg-muted rounded-lg text-[13px] font-medium text-text-secondary hover:text-primary hover:bg-primary/5 transition-all duration-150 cursor-pointer"
            >
              {m}개월
            </button>
          ))}
        </div>
      </Card>

      {/* Plan & Payment */}
      <Card>
        <h3 className="text-[14px] font-semibold text-text-primary mb-4">플랜 & 결제</h3>

        <div className="mb-4">
          <label className="block text-[13px] font-medium text-text-secondary mb-2">플랜 선택</label>
          <div className="flex gap-2">
            {Object.entries(RENTAL_PLANS).map(([name, info]) => (
              <button
                key={name}
                type="button"
                onClick={() => handlePlanSelect(name)}
                className={`flex-1 p-3.5 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                  form.plan === name
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-bg-muted text-text-secondary hover:border-text-tertiary'
                }`}
              >
                <p className="text-[14px] font-semibold">{name}</p>
                <p className="text-[12px] mt-0.5 opacity-80">{info.area} · {info.fee.toLocaleString()}원</p>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="월 결제금액 (원)"
          type="number"
          value={form.monthly_fee}
          onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
          placeholder="79000"
        />

        <div className="mt-4">
          <label className="block text-[13px] font-medium text-text-secondary mb-2">결제 수단</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setForm({ ...form, payment_method: method })}
                className={`px-4 py-2.5 rounded-xl border text-[14px] font-medium transition-all duration-150 cursor-pointer ${
                  form.payment_method === method
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-bg-muted text-text-secondary'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Select
            label="결제 상태"
            options={[
              { value: '대기', label: '대기' },
              { value: '납부완료', label: '납부완료' },
              { value: '미납', label: '미납' },
            ]}
            value={form.payment_status}
            onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
            className="w-full"
          />
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">메모</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="메모를 입력하세요..."
          className="w-full bg-bg-input border border-border rounded-xl px-3.5 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150 resize-none"
        />
      </Card>

      <div className="flex gap-3">
        <Button type="submit" variant="primary" className="flex-1" loading={saving}>
          계약 등록
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()} className="flex-1">
          취소
        </Button>
      </div>
    </form>
  );
}
