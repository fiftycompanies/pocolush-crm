'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GUIDE_VERSION } from '@/content/guide';
import GuideModal from '@/components/member/GuideModal';
import toast from 'react-hot-toast';

const INTERESTED_CROPS_OPTIONS = [
  '토마토', '상추', '고추', '오이', '가지', '감자', '당근', '파', '깻잎', '허브', '기타',
];

export default function MemberSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  // D2=A (PIPA §22① 분리): A=이용가이드, B=개인정보 별도 동의
  const [agreedGuide, setAgreedGuide] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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

    // D2=A: 2개 분리 검증 (어느 쪽이 빠졌는지 명시적 안내)
    if (!agreedGuide) {
      toast.error('[필수] 자람터 이용 가이드 동의가 필요합니다.');
      return;
    }
    if (!agreedPrivacy) {
      toast.error('[필수] 개인정보 수집·이용 동의가 필요합니다.');
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
          agreed: true,                          // legacy 호환 (개인정보 동의)
          agreed_guide_version: GUIDE_VERSION,   // PIPA §22① 별도 동의 (057 트리거가 audit_logs 기록)
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

          {/* A. 이용가이드 동의 (PIPA §22① 별도 동의, 전자상거래법 §13) */}
          <label className="flex items-start gap-3 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={agreedGuide}
              onChange={e => setAgreedGuide(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-border accent-[#16A34A]"
              aria-describedby="guide-consent-desc"
            />
            <span id="guide-consent-desc" className="text-[13px] text-text-secondary leading-relaxed">
              <span className="text-text-primary font-medium">[필수]</span>{' '}
              본인은 우편 또는 온라인으로 제공된 <strong className="text-text-primary">「자람터 주말농장 이용 가이드」</strong>의
              이용 규정, 운영 방식, 환불 규정을 모두 확인하였으며, 이에 동의합니다.
              <br />
              <span className="block mt-1 text-[11px] text-text-tertiary">
                ※ 우편 또는 온라인으로 이용 가이드를 전달받지 못한 경우, 자람터 고객센터(050-7457-5976)로
                문의하여 이용 가이드를 확인한 후 동의합니다에 체크합니다.
              </span>
            </span>
          </label>

          {/* 환불 규정 3줄 요약 (전자상거래법 §13 사전 고지, Security P0-1) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-900">
            <p className="font-semibold mb-1">💡 환불 규정 요약</p>
            <ul className="space-y-0.5 list-disc pl-4">
              <li>계약 후 <strong>7일 이내</strong>: 100% 환불</li>
              <li>이용시작 <strong>30일 전 이내</strong>: 50% 환불</li>
              <li>이후 환불 불가</li>
            </ul>
          </div>

          {/* B. 개인정보 수집·이용 동의 (PIPA §15) */}
          <label className="flex items-start gap-3 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={e => setAgreedPrivacy(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-border accent-[#16A34A]"
              aria-describedby="privacy-consent-desc"
            />
            <span id="privacy-consent-desc" className="text-[13px] text-text-secondary leading-relaxed">
              <span className="text-text-primary font-medium">[필수]</span> 개인정보 수집·이용에 동의합니다.
              이름, 연락처, 주소, 차량번호를 회원 관리 및 서비스 제공 목적으로 수집하며, 회원 탈퇴 시 즉시 파기합니다.
            </span>
          </label>

          {/* 가이드 읽기 (체크박스 밖, 독립 버튼 — UX BLOCKER-1 해결: 라벨 내부 인라인 금지) */}
          <div className="border-t border-dashed border-border pt-3">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-haspopup="dialog"
              className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium text-forest hover:bg-forest/5 rounded-lg transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              📖 자람터 이용 가이드 보기
            </button>
          </div>

          <button type="submit" disabled={loading || !agreedGuide || !agreedPrivacy}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] rounded-xl h-12 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-xs">
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-center text-text-secondary text-[13px] mt-6">
          이미 회원이신가요?{' '}
          <Link href="/m/login" className="text-[#16A34A] font-medium hover:underline">로그인</Link>
        </p>
      </div>

      {/* GuideModal: form 바깥 마운트 — ESC→submit 방지 (Frontend P0) */}
      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
