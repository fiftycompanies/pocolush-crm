'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

const INTERESTED_CROPS_OPTIONS = [
  '토마토', '상추', '고추', '오이', '가지', '감자', '당근', '파', '깻잎', '허브', '기타',
];

export default function MemberSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // 필수 필드
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // 선택 필드
  const [farmingExperience, setFarmingExperience] = useState(false);
  const [interestedCrops, setInterestedCrops] = useState<string[]>([]);
  const [familySize, setFamilySize] = useState('');
  const [carNumber, setCarNumber] = useState('');

  const toggleCrop = (crop: string) => {
    setInterestedCrops(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      toast.error('개인정보 수집·이용에 동의해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: 'member',
          name,
          phone,
          address,
          agreed: true,
          farming_experience: farmingExperience,
          interested_crops: interestedCrops,
          family_size: familySize ? parseInt(familySize) : null,
          car_number: carNumber || null,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('이미 등록된 이메일입니다.');
      } else {
        toast.error('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
      setLoading(false);
      return;
    }

    // 트리거에서 모든 필드를 처리하므로 추가 쿼리 불필요
    router.push('/m/signup/pending');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-1.5 mb-6">
            <span className="text-[28px]">🌱</span>
            <span className="font-bold text-[20px] text-text-primary tracking-tight">자람터</span>
          </div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">회원가입</h1>
          <p className="text-[14px] text-text-secondary mt-1.5">자람터 회원 정보를 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 필수 정보 */}
          <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary mb-1">필수 정보</h3>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="이메일 *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="비밀번호 (6자 이상) *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required placeholder="비밀번호 확인 *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="이름 *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="연락처 (010-0000-0000) *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} required placeholder="주소 *"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
          </div>

          {/* 선택 정보 */}
          <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">선택 정보</h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={farmingExperience} onChange={e => setFarmingExperience(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-[#16A34A]" />
              <span className="text-sm text-text-primary">텃밭 경험이 있어요</span>
            </label>

            <div>
              <p className="text-sm text-text-secondary mb-2">관심 작물 (복수 선택)</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTED_CROPS_OPTIONS.map(crop => (
                  <button key={crop} type="button" onClick={() => toggleCrop(crop)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      interestedCrops.includes(crop)
                        ? 'bg-[#16A34A] text-white border-[#16A34A]'
                        : 'bg-white text-text-secondary border-border hover:border-[#16A34A]/40'
                    }`}>
                    {crop}
                  </button>
                ))}
              </div>
            </div>

            <input type="number" value={familySize} onChange={e => setFamilySize(e.target.value)} placeholder="가족 구성원 수"
              min="1" max="20"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />

            <input type="text" value={carNumber} onChange={e => setCarNumber(e.target.value)} placeholder="차량번호 (입차 등록용)"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10" />
          </div>

          {/* 개인정보 동의 */}
          <label className="flex items-start gap-3 cursor-pointer px-1">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-border accent-[#16A34A]" />
            <span className="text-[13px] text-text-secondary leading-relaxed">
              <span className="text-text-primary font-medium">[필수]</span> 개인정보 수집·이용에 동의합니다.
              이름, 연락처, 주소, 차량번호를 회원 관리 및 서비스 제공 목적으로 수집하며, 회원 탈퇴 시 즉시 파기합니다.
            </span>
          </label>

          <button type="submit" disabled={loading || !agreed}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] rounded-xl h-12 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-xs">
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-center text-text-secondary text-[13px] mt-6">
          이미 회원이신가요?{' '}
          <Link href="/m/login" className="text-[#16A34A] font-medium hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  );
}
