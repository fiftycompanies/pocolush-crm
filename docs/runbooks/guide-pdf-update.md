# Runbook: 자람터 이용가이드 PDF 교체 절차

**적용 대상**: Phase 0.5 PR-H2 이후. `public-guides` 버킷 내 PDF.
**영향**: 회원가입 페이지 + `/member` 마이페이지 4번째 카드에서 다운로드되는 PDF.

## 배경

- 버킷: `public-guides` (public=TRUE, 2MB 한도, MIME: application/pdf)
- 경로: `v{YEAR}/jaramter-guide.pdf`
  - 예: `v2026/jaramter-guide.pdf`
- 공개 URL: `https://{SUPABASE_REF}.supabase.co/storage/v1/object/public/public-guides/{path}`
- 환경변수: `NEXT_PUBLIC_GUIDE_PDF_URL` (Vercel Production/Preview에 등록)
- 동의 버전: `content/guide.tsx` 의 `GUIDE_VERSION` (예: `v2026`)
- 회원가입 시 `agreed_guide_version` 컬럼에 저장 (057 마이그레이션)

## 교체 시나리오

### 시나리오 A — 오타 수정 (버전 미변경)

가이드 내용에 오타를 수정했지만 본질적 변경 없음 → `GUIDE_VERSION` 유지, 파일만 교체.

```bash
# 1. 로컬에 새 PDF 준비 (jaramter-guide.pdf)
# 2. service_role 업로드 (Dashboard UI 는 한국어 파일명 거부하므로 스크립트 사용 권장)

node - <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pdf = readFileSync('./jaramter-guide.pdf');
const { error } = await supabase.storage
  .from('public-guides')
  .upload('v2026/jaramter-guide.pdf', pdf, {
    contentType: 'application/pdf',
    upsert: true,  // 기존 덮어쓰기
  });

if (error) throw error;
console.log('✅ upload OK');
EOF
```

**검증**:
```bash
curl -I "$NEXT_PUBLIC_GUIDE_PDF_URL"
# HTTP/2 200
# content-type: application/pdf
```

### 시나리오 B — 중대 변경 (연도 롤오버, 이용규정 개정)

이용규정·환불조항 등 본질 변경 → 버전 번호 올림 + 재동의 유도.

1. **새 버전 경로로 업로드** — `v2027/jaramter-guide.pdf`
2. **`content/guide.tsx` 수정**:
   ```ts
   export const GUIDE_VERSION = 'v2027';
   ```
3. **환경변수 갱신** (Vercel):
   ```bash
   vercel env rm NEXT_PUBLIC_GUIDE_PDF_URL production
   vercel env add NEXT_PUBLIC_GUIDE_PDF_URL production
   # 새 경로 붙여넣기
   vercel env rm NEXT_PUBLIC_GUIDE_PDF_URL preview
   vercel env add NEXT_PUBLIC_GUIDE_PDF_URL preview
   ```
4. **렌더 페이지 수정** — `content/guide.tsx` JSX 본문도 동일하게 개정.
5. **재배포**:
   ```bash
   vercel --prod
   ```
6. **기존 회원 재동의 유도** (필요 시):
   - `SELECT id, agreed_guide_version FROM members WHERE agreed_guide_version != 'v2027';`
   - 마이페이지 진입 시 배너 노출 or 이메일 발송 (별도 기능)
7. **구 버전 보존**: `v2026/jaramter-guide.pdf` 는 삭제하지 말 것. 구 가입자 증거용.

## 롤백

교체 후 문제 발견 시 (예: 잘못된 PDF 업로드):

```bash
# 이전 버전 공개 URL 로 환경변수 즉시 전환
vercel env rm NEXT_PUBLIC_GUIDE_PDF_URL production
vercel env add NEXT_PUBLIC_GUIDE_PDF_URL production
# 이전 경로 붙여넣기
vercel --prod
```

Storage 객체 자체는 유지 (공간 여유 충분, 감사용).

## 체크리스트

- [ ] PDF 파일명은 ASCII (한국어 파일명은 Dashboard UI 거부)
- [ ] MIME 은 `application/pdf` 명시
- [ ] 파일 크기 < 2MB (버킷 한도)
- [ ] 업로드 후 `curl -I` 로 200 + Content-Type 확인
- [ ] Vercel env 변경 후 **반드시 재배포** (런타임 리빌드 필요)
- [ ] 마이페이지 + 회원가입 페이지 둘 다에서 "PDF 다운로드" 버튼 눌러 다운로드 확인
- [ ] `GuideModal` 본문 텍스트(`content/guide.tsx`) 와 PDF 내용이 일치하는지 확인
- [ ] 중대 변경 시 `GUIDE_VERSION` + `agreed_guide_version` 호환성 검토

## 연관 파일 / 마이그레이션

- `content/guide.tsx` — 가이드 JSX 렌더 (GUIDE_VERSION 내보냄)
- `components/member/GuideModal.tsx` — 모달 + 다운로드 버튼
- `app/m/signup/page.tsx` — 회원가입 체크박스에 버전 저장
- `supabase/migrations/055_*.sql` — public-guides 버킷 assertion
- `supabase/migrations/057_agreed_guide_version.sql` — members.agreed_guide_version 컬럼

## 알림

변경 후 Slack #ops-crm 에 다음 포맷으로 공지:

```
[가이드 업데이트] vYYYY-MM-DD
- 버전: v2026 → v2027
- 주요 변경: ....
- 재동의 유도: yes/no
- URL: <새 PDF URL>
```
