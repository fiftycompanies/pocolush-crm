'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Member } from '@/types';

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [familySize, setFamilySize] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from('members').select('*').eq('user_id', user.id).maybeSingle();
      if (m) {
        setMember(m);
        setName(m.name);
        setPhone(m.phone);
        setAddress(m.address);
        setCarNumber(m.car_number || '');
        setFamilySize(m.family_size?.toString() || '');
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);

    const { error } = await supabase.from('members').update({
      name, phone, address,
      car_number: carNumber || null,
      family_size: familySize ? parseInt(familySize) : null,
    }).eq('id', member.id);

    if (error) {
      toast.error('저장에 실패했습니다.');
    } else {
      toast.success('회원정보가 수정되었습니다.');
    }

    // 비밀번호 변경
    if (newPassword) {
      if (newPassword !== newPasswordConfirm) {
        toast.error('비밀번호가 일치하지 않습니다.');
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        toast.error('비밀번호는 6자 이상이어야 합니다.');
        setSaving(false);
        return;
      }
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) {
        toast.error('비밀번호 변경에 실패했습니다.');
      } else {
        toast.success('비밀번호가 변경되었습니다.');
        setNewPassword('');
        setNewPasswordConfirm('');
      }
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary">회원정보 수정</h1>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">이름</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">연락처</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">주소</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">차량번호</label>
          <input type="text" value={carNumber} onChange={e => setCarNumber(e.target.value)} placeholder="선택사항"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">가족 구성원 수</label>
          <input type="number" value={familySize} onChange={e => setFamilySize(e.target.value)} placeholder="선택사항" min="1"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">비밀번호 변경</h3>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="새 비밀번호 (변경 시에만 입력)"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
        <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="비밀번호 확인"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl h-12 transition-all disabled:opacity-40">
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
