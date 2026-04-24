/**
 * 자람터 주말농장 이용 가이드 v2026 (JSX 하드코딩)
 * - Phase 0.5 hot-track PR-H2
 * - 원본 PDF: /public-guides/v2026/jaramter-guide.pdf
 * - 업데이트 주기: 연 1~2회 (v2027 추가 시 별도 컴포넌트로 분리)
 * - Server Component (번들 경량화)
 */

import { OFFICE_PHONE, OFFICE_PHONE_TEL } from '@/lib/constants';

export const GUIDE_VERSION = 'v2026';
export const GUIDE_TITLE = '자람터 주말농장 이용 가이드';

export function GuideContent() {
  return (
    <article className="prose prose-sm sm:prose max-w-none prose-headings:font-bold prose-headings:text-forest prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-5 prose-strong:text-forest">
      {/* 표지 */}
      <header className="text-center mb-8 pb-6 border-b border-border">
        <h1 className="text-2xl font-bold text-forest mb-2 mt-0">자람터 주말농장 이용 매뉴얼</h1>
        <p className="text-sm text-text-secondary mb-1">경상북도 칠곡군 북삼읍 보손리 556 (포코러쉬 내)</p>
        <p className="text-sm text-text-secondary">
          문의: <a href={OFFICE_PHONE_TEL} className="text-forest underline">{OFFICE_PHONE}</a>
        </p>
      </header>

      {/* 1. 농장 소개 */}
      <section>
        <h2>1. 농장 소개</h2>
        <p>
          자람터 주말농장은 도시민이 자연을 가까이 경험하며 가족 중심 농사 체험을 즐길 수 있는
          프리미엄 텃밭 공간입니다. 주말마다 텃밭을 가꾸고, 자녀 교육·가족 힐링을 모두 즐길 수 있습니다.
        </p>
        <ul>
          <li><strong>위치</strong>: 경상북도 칠곡군 북삼읍 보손리 556 (포코러쉬 내)</li>
          <li><strong>문의</strong>: {OFFICE_PHONE}</li>
        </ul>
      </section>

      {/* 2. 회원 혜택 */}
      <section>
        <h2>2. 회원 혜택</h2>
        <ul>
          <li>전기·수도 무료 이용</li>
          <li>공용 농기구 무상 대여</li>
          <li>편의시설: 화장실, 주차장</li>
          <li>제휴시설: 포코러쉬 풀빌라 할인권, 포코러쉬 워터룸 할인권 등</li>
          <li>체험시설: 키즈놀이터, 모래놀이터, 에어바운스, 야외 수영장(여름 시즌)</li>
          <li>동물 먹이주기 (리뷰 작성 시 무료 / 제공된 먹이만 가능)</li>
          <li>시즌 프로그램: 모종심기, 수확체험, 김장, 잼만들기 등 <em>(업체 상황에 따라 변동될 수 있습니다)</em></li>
        </ul>
      </section>

      {/* 3. 분양 및 이용 안내 */}
      <section>
        <h2>3. 분양 및 이용 안내</h2>
        <div className="overflow-x-auto not-prose">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-forest text-white">
                <th className="px-3 py-2 text-left font-semibold border border-forest">항목</th>
                <th className="px-3 py-2 text-left font-semibold border border-forest">내용</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-border">기본 구좌</td><td className="px-3 py-2 border border-border">3평 / 연 30만원 (월 2.5만원)</td></tr>
              <tr><td className="px-3 py-2 border border-border">이용기간</td><td className="px-3 py-2 border border-border">결제 시점으로부터 1년</td></tr>
              <tr><td className="px-3 py-2 border border-border">회원권 구성</td><td className="px-3 py-2 border border-border">회원카드, 이용가이드</td></tr>
              <tr><td className="px-3 py-2 border border-border">모종·씨앗</td><td className="px-3 py-2 border border-border">제공 (연 3회)</td></tr>
            </tbody>
          </table>
        </div>

        <h3>2026년 멤버십 이용 안내</h3>
        <div className="overflow-x-auto not-prose">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-forest text-white">
                <th className="px-3 py-2 text-left font-semibold border border-forest">구분</th>
                <th className="px-3 py-2 text-left font-semibold border border-forest">기간</th>
                <th className="px-3 py-2 text-left font-semibold border border-forest">비고</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-border">농사 기간</td><td className="px-3 py-2 border border-border">2026년 5월 ~ 11월</td><td className="px-3 py-2 border border-border">텃밭 경작 가능</td></tr>
              <tr><td className="px-3 py-2 border border-border">휴농 기간</td><td className="px-3 py-2 border border-border">2026년 12월 ~ 2027년 3월</td><td className="px-3 py-2 border border-border">텃밭 경작 휴식</td></tr>
              <tr><td className="px-3 py-2 border border-border">부대시설 이용</td><td className="px-3 py-2 border border-border">2026년 5월 ~ 2027년 4월 말</td><td className="px-3 py-2 border border-border">연중 이용 가능</td></tr>
              <tr><td className="px-3 py-2 border border-border">2027년 멤버십 갱신 회원</td><td className="px-3 py-2 border border-border">2027년 4월부터 농사 가능</td><td className="px-3 py-2 border border-border"></td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-tertiary mt-2">
          ※ 텃밭 경작이 불가한 기간(12월~4월)에도 동물 먹이주기 체험, 키즈놀이터, 모래놀이터 등
          부대시설은 멤버십 기간 내 정상 이용 가능합니다.
        </p>

        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-md p-3 my-4 not-prose">
          <p className="text-sm font-semibold text-amber-900 mb-1">✨ 2026년 멤버십 회원 특별 혜택</p>
          <p className="text-xs text-amber-800 mb-2">
            2026년은 5월부터 경작이 시작되는 점을 감안하여, 멤버십 회원에게 아래 혜택을 제공합니다.
          </p>
          <ul className="text-xs text-amber-800 list-disc ml-5 space-y-0.5">
            <li>포코러쉬 숙박 평일 50% 할인권</li>
            <li>포코러쉬 워터룸 이용료 5만원 할인권</li>
          </ul>
        </div>
      </section>

      {/* 4. 신청 및 결제 절차 */}
      <section>
        <h2>4. 신청 및 결제 절차</h2>
        <p className="text-sm">
          <strong>회원권은 본인 사용을 원칙으로 하며 타인에게 양도·대여할 수 없습니다.</strong>
          무단 양도 적발 시 회원자격이 즉시 박탈되며 환불은 불가합니다.
        </p>
        <ol>
          <li>희망 구좌 회신 (3평 단위)</li>
          <li>계약금 30만원 입금 → 신청 완료</li>
          <li>회원권 및 이용가이드 발송</li>
        </ol>
        <p className="text-sm">
          <strong>입금계좌</strong>: 기업은행 505-070795-01-014 / 예금주: 와이드와일드
        </p>

        <h3>환불규정</h3>
        <ul>
          <li>계약 후 <strong>7일 이내</strong>: 100% 환불</li>
          <li>이용시작 <strong>30일 전 이내</strong>: 50% 환불</li>
          <li>이후 환불 불가</li>
        </ul>
      </section>

      {/* 5. 농장 배정 및 일정 */}
      <section>
        <h2>5. 농장 배정 및 일정</h2>
        <ul>
          <li><strong>배정방식</strong>: 선착순 배정 (300구좌)</li>
          <li><strong>정식 경작 시작</strong>: 2026년 5월 9일</li>
        </ul>
      </section>

      {/* 6. 기본 이용 수칙 */}
      <section>
        <h2>6. 기본 이용 수칙</h2>
        <ol className="text-sm leading-relaxed">
          <li><strong>운영시간</strong>: 평일 10:00-18:00 / 주말·공휴일 08:00-18:00. 여름에는 폭염으로 인하여 운영시간 단축 가능</li>
          <li><strong>입장인원</strong>: 회원 본인 + 4인 무료 (초과 시 1인당 5,000원)</li>
          <li><strong>제휴할인 적용방법</strong>: 회원카드(본인확인) 확인 후 관리동에서 할인 적용</li>
          <li><strong>외부 음식 규정</strong>: 회원 전용 쉼터 이용 시 반입 가능</li>
          <li><strong>농기구</strong>: 사용 후 세척 후 즉시 반납, 분실·파손 시 실비 기준 배상. 수도는 공동 자원으로 과다 사용 제한. 호스 상시 연결·자동관수장치 설치는 사전 승인 후 가능</li>
          <li><strong>재배규칙</strong>: 기본 모종 외 작물은 사전 승인 필요, 화학농약 사용 불가. 친환경 인증 약제 사용 시 관리동 사전 승인 필수, 인접 구좌 피해 발생 시 사용자 책임</li>
          <li><strong>개인 시설물</strong>: 승인 후 설치 가능(고추대, 멀칭비닐 등 보증금 3만원), 대형 구조물 불가</li>
          <li><strong>쓰레기</strong>: 모든 쓰레기 및 부산물 전량 반출, 무단 투기 시 과태료 10만원</li>
          <li><strong>흡연</strong>: 지정된 구역 외 금지</li>
          <li><strong>차량</strong>: 농장 내 차량 진입 제한 / 지정 주차구역 이용</li>
          <li><strong>멀칭비닐·고추대 설치 시</strong>: 별도 텃밭 배정(보증금 3만원)</li>
          <li><strong>겨울 작물 재배</strong>: 사전 협의 필수</li>
        </ol>
      </section>

      {/* 7. 계절별 운영 안내 */}
      <section>
        <h2>7. 계절별 운영 안내</h2>
        <p className="text-sm text-text-secondary">
          폭염·폭우·한파 등 기상특보 발효 시 운영이 일시 중단될 수 있으며, 문자 또는 단체 공지를 통해 안내드립니다.
        </p>
        <ul>
          <li><strong>봄(3~5월)</strong>: 토양 준비, 모종심기, 공동 농자재 지원</li>
          <li><strong>여름(6~8월)</strong>: 병해충 교육 제공, 폭염 시 단축 운영 가능</li>
          <li><strong>가을(9~11월)</strong>: 수확기, 텃밭 정리, 작물 잔재 전량 회수</li>
          <li><strong>겨울(12~2월)</strong>: 시설 점검 (겨울 작물 재배자 출입 가능)</li>
        </ul>
      </section>

      {/* 8. 운영 규정 (필독) */}
      <section>
        <div className="bg-amber-50 border-l-4 border-amber-600 rounded-r-md p-4 my-4 not-prose" role="region" aria-label="운영 규정 필독">
          <h2 className="text-lg font-bold text-amber-900 mb-3 mt-0">⚠ 8. 운영 규정 (필독)</h2>
          <ol className="text-[13px] leading-relaxed text-amber-900 space-y-1.5 ml-4 list-decimal">
            <li>1개월 이상 방치 시 예초·밭갈이 등 임의 조치 가능. 수확 후 7일 이상 방치된 농작물은 위생 및 해충 방지를 위해 임의 정리될 수 있음. 수확물 분실·도난에 대해서는 운영측이 책임지지 않음</li>
            <li>화학비료·합성농약·비닐멀칭 금지 (위반 시 즉시 사용 중지 및 반환)</li>
            <li>옥수수·해바라기 등 키 큰 작물은 재배 제한</li>
            <li>배수로·통로에 작물 식재·구조물 설치 금지</li>
            <li>1개월 이상 미경작 시 예비 대기자에게 재배정 가능</li>
            <li>민원·분쟁 발생 시 다음 연도 신청 제한 가능</li>
            <li>운영규정 및 이행서약 미숙지로 인한 책임은 신청자에게 있음</li>
            <li>자연재해·작물 실패는 보상 불가</li>
            <li>뱀, 야생동물로 인한 사고는 본인 부주의로 보상 불가 (장화 및 긴바지 권장)</li>
            <li>어린이 농기구 사고 예방 철저히 부탁드립니다</li>
            <li>미성년자는 보호자 동반 원칙, 단독 출입 제한. 음주 상태에서 농기구 사용 금지</li>
            <li>쓰레기는 반드시 종량제 봉투에 담아 반출</li>
            <li>무단 경작지 확장 및 구획 침범 시 퇴거 가능</li>
            <li>경작지에서 모닥불, 버너 모든 화기 사용 금지</li>
            <li>큰 소리·스피커 음악 등 소음 행위 금지</li>
            <li>상업 목적 작물 재배 또는 판매 행위 금지</li>
            <li>반려동물 방치 및 배변 즉시 처리</li>
            <li>음식물 쓰레기 및 농자재 투기 금지 (위반 시 과태료 10만원)</li>
            <li>정자·쉼터·화장실은 공동시설이므로 깨끗하게 사용</li>
            <li>농작물 도난·훼손 시 CCTV 확인 후 조치</li>
            <li>미승인 구조물은 철거 요청될 수 있음</li>
            <li>농장 내 행사 및 촬영 사진은 홍보 목적에 활용될 수 있음. 초상권 사용을 원치 않을 경우 사전 요청 바람</li>
          </ol>
        </div>
      </section>

      {/* 9. 고객 지원 */}
      <section>
        <h2>9. 고객 지원</h2>
        <ul>
          <li><strong>문의</strong>: <a href={OFFICE_PHONE_TEL} className="text-forest underline">{OFFICE_PHONE}</a></li>
          <li><strong>주소</strong>: 경상북도 칠곡군 북삼읍 보손리 556 (포코러쉬 내)</li>
        </ul>
      </section>

      {/* 푸터 */}
      <footer className="mt-10 pt-6 border-t border-border text-center">
        <p className="text-sm text-text-secondary italic mb-1">
          자람터는 가족이 함께 자연을 배우는 프리미엄 주말농장입니다.
        </p>
        <p className="text-sm text-text-secondary italic mb-4">
          회원님의 편안하고 즐거운 농장생활을 위해 최선을 다해 운영하겠습니다.
        </p>
        <p className="text-xs text-text-tertiary">자람터 주말농장 드림</p>
        <p className="text-[10px] text-text-tertiary mt-4">
          본 매뉴얼은 2026년 가입 회원에 한해 적용되며,<br />
          2027년 이후 가입 회원에 대해서는 별도 업데이트된 매뉴얼이 안내될 예정입니다.
        </p>
      </footer>
    </article>
  );
}
