import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '포코러쉬 자람터 개인정보처리방침 — PIPA 정합',
};

/**
 * 070: 개인정보처리방침 (PIPA §30①)
 * - signup 페이지 4대 고지 details 에서 링크
 * - target="_blank" 로 신규 탭 오픈
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-[14px] text-text-secondary leading-relaxed space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary mb-2">개인정보처리방침</h1>
        <p className="text-xs text-text-tertiary">시행일: 2026-05-13</p>
      </header>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">1. 수집하는 개인정보 항목</h2>
        <p>회원가입 시 다음 정보를 수집합니다.</p>
        <ul className="list-disc pl-6 mt-1">
          <li>필수: 이름, 연락처(전화번호), 이메일, 주소, 차량번호</li>
          <li>자동 수집: IP 주소, User-Agent, 접속 일시 (PIPA 동의 증빙용)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">2. 수집·이용 목적</h2>
        <ul className="list-disc pl-6">
          <li>회원 관리 (가입, 인증, 탈퇴)</li>
          <li>서비스 제공 (텃밭 임대, BBQ 예약, 회원권 관리)</li>
          <li>계약 이행 (요금 정산, 환불, 임대 갱신)</li>
          <li>알림 발송 (예약 확정, 만료 안내)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">3. 보유·이용 기간</h2>
        <ul className="list-disc pl-6">
          <li>회원 정보: 회원 탈퇴 신청 시 <strong>30일 grace 기간</strong> 후 자동 파기</li>
          <li>거래·정산·임대 기록: <strong>5년 보관</strong> (전자상거래법 §6③)</li>
          <li>접속 로그·IP: 3개월 (통신비밀보호법)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">4. 동의 거부권 및 불이익</h2>
        <p>회원은 개인정보 수집·이용 동의를 거부할 권리가 있습니다. 다만 거부 시 회원가입이 제한되며, 서비스 이용이 불가능합니다.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">5. 제3자 제공</h2>
        <p>원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다음 경우 예외적으로 제공합니다.</p>
        <ul className="list-disc pl-6 mt-1">
          <li>법령에 의거 수사기관의 요청이 있는 경우</li>
          <li>회원이 사전에 명시적으로 동의한 경우</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">6. 처리 위탁</h2>
        <ul className="list-disc pl-6">
          <li>Supabase (데이터베이스 호스팅) — 미국/싱가포르 리전</li>
          <li>Vercel (애플리케이션 호스팅)</li>
          <li>알리고 (알림톡 발송) — 국내 SMS/카카오 채널</li>
          <li>Firebase Cloud Messaging (앱 푸시 알림)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">7. 개인정보 파기 절차</h2>
        <p>회원 탈퇴 신청 시점에 30일 grace 가 시작되며, 그 기간 동안 회원은 [복원] 기능으로 모든 데이터를 복원할 수 있습니다. 30일 경과 후:</p>
        <ul className="list-disc pl-6 mt-1">
          <li>이름: <code>탈퇴회원</code> 으로 마스킹</li>
          <li>연락처: <code>***</code> 마스킹</li>
          <li>주소: <code>***</code> 마스킹</li>
          <li>이메일: <code>deleted_&lt;uuid&gt;@deleted.local</code> 변경</li>
          <li>차량번호: NULL</li>
          <li>거래·정산 기록은 5년 동안 분리 보관</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">8. 정보주체 권리</h2>
        <p>회원은 언제든 다음 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-6 mt-1">
          <li>개인정보 열람 요구</li>
          <li>오류 정정 요구</li>
          <li>삭제 요구 (마이페이지 → 탈퇴)</li>
          <li>처리 정지 요구</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">9. 개인정보보호 책임자</h2>
        <p>이름: 포코러쉬 자람터 관리사무소<br/>
        연락처: 050-7457-5976<br/>
        이메일: privacy@pocolush.co.kr</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary mb-2">10. 변경 이력</h2>
        <ul className="list-disc pl-6">
          <li>2026-05-13: 최초 시행 (PIPA §30① 정합 정비)</li>
        </ul>
      </section>
    </main>
  );
}
