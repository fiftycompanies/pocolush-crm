'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMemberModal({ open, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    car_number: '', family_size: '', farming_experience: false,
    interested_crops: '', memo: '',
  });

  const set = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('이름과 연락처를 입력해주세요.'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // phone 정규화 (숫자만). members.phone/customers.phone 일관성 확보.
    const normalizedPhone = form.phone.trim().replace(/[^0-9]/g, '');

    // customers에도 동시 upsert → 나중에 farm_rentals에서 phone으로 매칭 가능
    await supabase.from('customers').upsert(
      { name: form.name.trim(), phone: normalizedPhone },
      { onConflict: 'phone' }
    );

    const { error } = await supabase.from('members').insert({
      user_id: null,
      name: form.name.trim(),
      phone: normalizedPhone,
      email: form.email.trim() || `admin-${Date.now()}@pocolush.com`,
      address: form.address.trim() || '-',
      car_number: form.car_number.trim() || null,
      family_size: form.family_size ? parseInt(form.family_size) : null,
      farming_experience: form.farming_experience,
      interested_crops: form.interested_crops ? form.interested_crops.split(',').map(s => s.trim()) : [],
      memo: form.memo.trim() || null,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null,
    });

    if (error) {
      if (error.message?.includes('members_phone_unique')) {
        toast.error('이미 등록된 전화번호입니다.');
      } else {
        toast.error('등록에 실패했습니다.');
      }
    } else {
      toast.success('회원이 추가되었습니다.');
      onSuccess();
      onClose();
      setForm({ name: '', phone: '', email: '', address: '', car_number: '', family_size: '', farming_experience: false, interested_crops: '', memo: '' });
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-2xl p-6 w-[480px] max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">회원 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">이름 *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">연락처 *</label>
            <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-1234-5678"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">이메일</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">주소</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">차량번호</label>
              <input type="text" value={form.car_number} onChange={e => set('car_number', e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">가족 수</label>
              <input type="number" value={form.family_size} onChange={e => set('family_size', e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text-secondary">영농경험</label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.farming_experience} onChange={e => set('farming_experience', e.target.checked)} className="rounded" />
              있음
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">관심작물 (콤마 구분)</label>
            <input type="text" value={form.interested_crops} onChange={e => set('interested_crops', e.target.value)} placeholder="토마토, 고추, 상추"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">메모</label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={2}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-y" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2.5 border border-border rounded-xl text-sm">취소</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-40">
            {saving ? '추가 중...' : '회원 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
