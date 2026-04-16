# 문의 엑셀 다운로드 리서치

## 1. 현재 상태

### 프로젝트 스택
- Next.js 16.1.6 + React 19.2.3 + Supabase + TypeScript
- 엑셀 관련 라이브러리: **없음**
- 기존 다운로드/내보내기 기능: **없음**
- API Route: **없음** (모든 데이터 조회는 클라이언트에서 직접 Supabase 호출)

### 문의 데이터 구조 (Inquiry)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| customer_id | UUID | FK → customers |
| type | string | jaramter_inquiry, janchimaru_consult, campnic_notify, kids_notify |
| status | InquiryStatus | new, contacted, consulted, converted, cancelled |
| assignee_id | UUID | FK → profiles (담당자) |
| data | JSONB | 문의 유형별 커스텀 데이터 |
| tags | string[] | 태그 |
| source | string | 유입 경로 |
| created_at | timestamptz | 접수일시 |
| updated_at | timestamptz | 수정일시 |

JOIN 테이블:
- `customers`: name, phone
- `profiles` (assignee): name

### 현재 페이지 구조
- `app/dashboard/inquiries/page.tsx` — 필터(유형/상태/검색) + 테이블 + 드로어
- `components/inquiries/InquiryTable.tsx` — TanStack React Table
- `components/inquiries/InquiryFilters.tsx` — 유형 탭 + 상태 셀렉트 + 검색
- `lib/use-data.ts` → `useInquiries()` — Supabase 직접 조회

---

## 2. 글자깨짐(한글 깨짐) 분석

### CSV의 문제
- Excel은 CSV를 시스템 기본 인코딩(Windows: CP949/EUC-KR)으로 해석
- UTF-8 CSV → 한글 깨짐
- BOM(Byte Order Mark, `\xEF\xBB\xBF`)을 추가하면 일부 해결되지만 구버전 Excel/Mac Excel에서 불안정
- **결론: CSV는 한글 환경에서 사용하지 말 것**

### .xlsx가 정답인 이유
- XLSX는 내부적으로 XML 기반 → **항상 UTF-8**
- 별도 BOM 처리 불필요
- **모든 Excel 버전에서 한글/CJK 완벽 지원**
- 셀 서식(날짜, 숫자, 통화) 지정 가능

---

## 3. 파일깨짐 방지

### 주요 원인과 해결
| 원인 | 설명 | 해결 |
|------|------|------|
| Text로 전송 | res.send()가 문자열로 변환 | Buffer 그대로 전송 |
| Content-Type 오류 | text/plain 등 잘못된 타입 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| fetch에서 .text() 사용 | 바이너리 손상 | **반드시 .blob() 사용** |
| Next.js Response 래핑 | NextResponse.json() | `new Response(buffer)` 직접 사용 |
| 스트림 미완료 | 버퍼 미완성 | `await writeBuffer()` 완료 대기 |

### 필수 응답 헤더
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(filename)}
Content-Length: buffer.byteLength
Cache-Control: no-cache, no-store, must-revalidate
```

**`filename*=UTF-8''` 문법**: RFC 5987 표준으로 한글 파일명 안전하게 전달.

---

## 4. 라이브러리 비교

| 항목 | **exceljs** | **SheetJS (xlsx)** | **xlsx-populate** |
|------|------------|-------------------|-------------------|
| npm 다운로드 | ~2.5M/week | ~4M/week | ~200K/week |
| 라이선스 | MIT | Apache-2.0 (Community) | MIT |
| 서버사이드 | 최적화됨 | 가능 | 가능 |
| 스트리밍 쓰기 | ✅ | ❌ | ❌ |
| 셀 스타일링 | ✅ 풍부 (무료) | ⚠️ Pro만 풍부 | ✅ |
| TypeScript | ✅ 내장 | ⚠️ @types 필요 | ❌ |
| 한글 지원 | ✅ 완벽 | ✅ 완벽 | ✅ 완벽 |
| 유지보수 | 활발 | 활발 | 2022 이후 미약 |

### 결정: **exceljs**
- MIT 라이선스, TypeScript 내장, 서버사이드 최적화
- 셀 스타일링/병합/조건부서식 모두 무료
- 대용량 시 스트리밍 지원 (현재 CRM 규모에선 불필요)

---

## 5. 구현 전략: 서버사이드 API Route

### 왜 서버사이드인가
- **보안**: Supabase 서버 클라이언트로 인증된 사용자만 접근
- **안정성**: Node.js에서 exceljs 실행 → 브라우저 호환성 이슈 없음
- **번들 사이즈**: 클라이언트 번들에 exceljs (~1.2MB) 포함 안 됨
- **한글 안정성**: 서버에서 바이너리 생성 → 클라이언트는 blob 수신만

### 엑셀 컬럼 매핑
| 엑셀 헤더 | 소스 | 서식 |
|-----------|------|------|
| 유형 | `INQUIRY_TYPES[type].label` | 텍스트 |
| 이름 | `customer.name` | 텍스트 |
| 연락처 | `customer.phone` | 텍스트 |
| 상태 | `INQUIRY_STATUS[status].label` | 텍스트 |
| 담당자 | `assignee.name` | 텍스트 |
| 유입경로 | `source` | 텍스트 |
| 접수일시 | `created_at` | YYYY-MM-DD HH:mm |
| 수정일시 | `updated_at` | YYYY-MM-DD HH:mm |

### 필터 연동
- 현재 적용 중인 필터(유형/상태/검색)를 쿼리 파라미터로 API에 전달
- **"보이는 그대로 다운로드"** 원칙

---

## 6. 다른 서비스 영향 분석

### 영향 범위 (최소화)
| 대상 | 영향 |
|------|------|
| 기존 문의 페이지 | 버튼 1개 추가만 (InquiryFilters에) |
| 기존 컴포넌트 | 변경 없음 |
| 기존 API | 없음 (신규 라우트 추가) |
| DB 스키마 | 변경 없음 (읽기 전용) |
| 인증/미들웨어 | 기존 Supabase 세션 활용 |
| 번들 사이즈 | 클라이언트 영향 0 (서버사이드 전용) |

### 격리 포인트
- 새 파일만 추가: `app/api/inquiries/export/route.ts` + `lib/export-excel.ts`
- 기존 파일 수정: `InquiryFilters.tsx` (다운로드 버튼 추가)와 `page.tsx` (핸들러 전달)
- 기존 로직 변경: **없음**
