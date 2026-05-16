# 농장 현황 + 사이드바 순서 + 관리 이동 버튼 실행 플랜 v1

> **작성**: 2026-05-16 17:30
> **선행**: `thoughts/research/20260516-1700_farms_board_and_management_pivot_research.md`
> **상태**: 🔴 **kk 승인 대기**
> **권고**: research §5 의 **안 A (신규 페이지 + 기존 보존)** + Sidebar 메뉴 순서 변경 + 두 현황 페이지에 "관리하기 →" 버튼
> **변경 규모**: 코드 5 파일 + (선택) 마이그 084 0~1건
> **라이브 영향**: 0 (신규 페이지 + 사이드바 순서 변경만)

---

## 0. 한 줄 요약

> 평상 현황 패턴을 농장에 그대로 복제: `/dashboard/farms-board` 신설 (60 농장 매트릭스 + KPI 5종 + 임차인 검색 + FarmDrawer 재활용). 사이드바 [일별 운영]을 빈도 순 (대시보드/농장현황/평상현황/신청관리/문의관리)로 재배치. 두 현황 페이지 우측 상단에 "관리하기 →" outlined 버튼 추가 (Settings2 + ArrowRight 아이콘). 작업량 ~5h.

---

## 1. kk 결정 필요 (5건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 통합 안 | (A) 신규 페이지 + 기존 /farms 보존 / (B) 탭 추가 / (C) 페이지 자체 변경 / (D) Cloudbeds 풀 모방 | **A** ⭐ |
| **Q2** | 데이터 source | (1) useFarms 재사용 / (2) 신규 RPC 마이그 084 / (3) 둘 다 단계 적용 | **1** ⭐ (빠른 출시 + Phase 2 RPC) |
| **Q3** | "평상 예약 현황" 라벨 단축 | (a) "평상 현황" 으로 단축 / (b) 그대로 유지 | **a** ⭐ (농장 현황과 짝) |
| **Q4** | 만료 임박 임계 | (i) 7일 / (ii) 14일 / (iii) 30일 | **i** ⭐ (즉시 액션) |
| **Q5** | "관리하기 →" 버튼 디자인 | (1) outlined + Settings2 + ArrowRight / (2) icon-only / (3) text link | **1** ⭐ (Cloudbeds + Shopify 일치) |

답변 형식: `Q1=A, Q2=1, Q3=a, Q4=i, Q5=1` 또는 "권고대로".

---

## 2. 변경 파일 (5 파일 + 선택 마이그)

| 파일 | 변경 | LOC |
|---|---|---|
| `app/dashboard/farms-board/page.tsx` | 신규 페이지 (헤더 + KPI + 매트릭스 + 검색) | ~150 |
| `components/admin-farms/FarmsBoardKpi.tsx` | KPI 5종 카드 (신규) | ~60 |
| `components/admin-farms/FarmsBoardMatrix.tsx` | zone × number grid 매트릭스 (신규) | ~100 |
| `components/layout/Sidebar.tsx` | V2 dailyOpsNav 순서 변경 + V1 legacy 라벨 단축 | +5 / -3 |
| `app/dashboard/bbq-board/page.tsx` | 우측 상단 "관리하기 →" 버튼 추가 | +8 |
| (선택 Q2=2) `supabase/migrations/084_get_farms_board.sql` | 신규 RPC | ~60 |

---

## 3. Phase 1 — 신규 농장 현황 페이지 + 사이드바 순서 + 관리 이동 버튼

### 3-1. 신규 페이지 `app/dashboard/farms-board/page.tsx`

```tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, Settings2, ArrowRight } from 'lucide-react';
import { useFarms } from '@/lib/use-data';
import FarmsBoardKpi from '@/components/admin-farms/FarmsBoardKpi';
import FarmsBoardMatrix from '@/components/admin-farms/FarmsBoardMatrix';
import FarmDrawer from '@/components/farms/FarmDrawer';
import type { Farm } from '@/types';

export const dynamic = 'force-dynamic';

export default function FarmsBoardPage() {
  const { data: farms, zones, refetch } = useFarms();
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const minDelay = new Promise((r) => setTimeout(r, 600));
    try {
      await Promise.all([refetch(), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 검색 필터 (client-side, 평상 패턴 답습)
  const filteredFarms = useMemo(() => {
    if (!search.trim()) return farms;
    const q = search.toLowerCase();
    return farms.filter((f) => {
      const name = f.current_rental?.customer?.name?.toLowerCase() ?? '';
      const phone = f.current_rental?.customer?.phone ?? '';
      return name.includes(q) || phone.includes(q);
    });
  }, [farms, search]);

  return (
    <div className="space-y-5">
      {/* 헤더 + 관리하기 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            농장 현황
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            60 농장의 임대·만료·빈 상태를 실시간 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            aria-label={isRefreshing ? '갱신 중' : '새로고침'}
            className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-60 transition-opacity cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/dashboard/farms"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent cursor-pointer transition-colors"
          >
            <Settings2 className="size-4" />
            관리하기
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="임차인명 / 전화번호"
          className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
        />
      </div>

      {/* KPI 카드 */}
      <FarmsBoardKpi farms={farms} zones={zones} />

      {/* 매트릭스 (zone × number) */}
      <FarmsBoardMatrix
        farms={filteredFarms}
        zones={zones}
        onFarmClick={setSelectedFarm}
      />

      {/* 사이드 패널 (FarmDrawer 재활용) */}
      {selectedFarm && (
        <FarmDrawer
          farm={selectedFarm}
          onClose={() => setSelectedFarm(null)}
          onUpdated={refetch}
        />
      )}
    </div>
  );
}
```

### 3-2. KPI 컴포넌트 `components/admin-farms/FarmsBoardKpi.tsx`

```tsx
'use client';

import { Home, Users, AlertTriangle, Square, Ban } from 'lucide-react';
import type { Farm, FarmZone } from '@/types';

interface Props {
  farms: Farm[];
  zones: FarmZone[];
}

export default function FarmsBoardKpi({ farms, zones }: Props) {
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);

  const operationalZoneIds = new Set(
    zones.filter((z) => z.is_operational).map((z) => z.id),
  );

  const operational = farms.filter((f) => operationalZoneIds.has(f.zone_id));
  const nonOperational = farms.length - operational.length;
  const occupied = operational.filter((f) => f.current_rental).length;
  const expiringSoon = operational.filter((f) => {
    const end = f.current_rental?.end_date;
    if (!end) return false;
    return new Date(end) <= sevenDaysLater;
  }).length;
  const empty = operational.length - occupied;

  const kpis = [
    { label: '총 농장', value: operational.length, icon: Home, color: 'text-text-primary' },
    { label: '임대중', value: occupied, icon: Users, color: 'text-emerald-700' },
    { label: '만료 임박 (7일)', value: expiringSoon, icon: AlertTriangle, color: 'text-amber-700' },
    { label: '비어있음', value: empty, icon: Square, color: 'text-text-tertiary' },
    { label: '비운영', value: nonOperational, icon: Ban, color: 'text-text-tertiary opacity-60' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="bg-card border rounded-xl p-4 flex items-start justify-between"
          >
            <div>
              <p className="text-xs text-text-secondary">{k.label}</p>
              <p className={`text-2xl font-bold tracking-tight mt-1 ${k.color}`}>
                {k.value}
              </p>
            </div>
            <Icon className={`size-5 ${k.color}`} />
          </div>
        );
      })}
    </div>
  );
}
```

### 3-3. 매트릭스 컴포넌트 `components/admin-farms/FarmsBoardMatrix.tsx`

```tsx
'use client';

import { useMemo } from 'react';
import type { Farm, FarmZone } from '@/types';

interface Props {
  farms: Farm[];
  zones: FarmZone[];
  onFarmClick: (farm: Farm) => void;
}

const farmCellClass = (farm: Farm): string => {
  if (!farm.zone_id) return 'bg-gray-50 border-gray-200 opacity-60';
  const rental = farm.current_rental;
  if (!rental) return 'bg-gray-50 border-gray-200';

  // 만료 임박 7일 체크
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  if (rental.end_date && new Date(rental.end_date) <= sevenDaysLater) {
    return 'bg-amber-50 border-amber-200';
  }
  return 'bg-emerald-50 border-emerald-200';
};

export default function FarmsBoardMatrix({ farms, zones, onFarmClick }: Props) {
  // zone 별 grouping
  const farmsByZone = useMemo(() => {
    const map = new Map<string, Farm[]>();
    for (const z of zones) {
      map.set(z.id, farms.filter((f) => f.zone_id === z.id).sort((a, b) => a.number - b.number));
    }
    return map;
  }, [farms, zones]);

  if (farms.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-10 text-center text-sm text-text-secondary">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {zones
        .filter((z) => z.is_operational)
        .map((zone) => {
          const zoneFarms = farmsByZone.get(zone.id) ?? [];
          return (
            <section key={zone.id} className="bg-card border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{zone.name}</h3>
                <span className="text-xs text-text-secondary">
                  {zoneFarms.length}개 농장
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {zoneFarms.map((f) => {
                  const rental = f.current_rental;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onFarmClick(f)}
                      className={`rounded-lg p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border ${farmCellClass(f)}`}
                    >
                      <p className="text-xs font-bold">{f.number}번</p>
                      <p className="text-[11px] text-text-secondary truncate mt-0.5">
                        {rental?.customer?.name ?? '비어있음'}
                      </p>
                      {rental?.end_date && (
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          ~ {rental.end_date.slice(5).replace('-', '.')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}
```

### 3-4. 사이드바 `components/layout/Sidebar.tsx` 변경

```diff
const dailyOpsNav: NavItem[] = [
  { href: '/dashboard',           label: '대시보드',           icon: LayoutDashboard },
- { href: '/dashboard/requests',  label: '신청 관리',          icon: ClipboardList },
- { href: '/dashboard/bbq-board', label: '평상 예약 현황',      icon: LayoutGrid },
+ { href: '/dashboard/farms-board', label: '농장 현황',         icon: Map },           // NEW
+ { href: '/dashboard/bbq-board', label: '평상 현황',           icon: LayoutGrid },     // 라벨 단축
+ { href: '/dashboard/requests',  label: '신청 관리',          icon: ClipboardList },
  { href: '/dashboard/inquiries', label: '문의 관리',          icon: MessageSquare },
];

// V1 legacy 도 동일 라벨 단축
const legacyMemberNav: NavItem[] = [
  ...
- { href: '/dashboard/bbq-board', label: '평상 예약 현황',      icon: LayoutGrid },
+ { href: '/dashboard/bbq-board', label: '평상 현황',           icon: LayoutGrid },
  ...
];
```

**중요**: Map 아이콘은 자원·시설 그룹의 "농장 관리"와 중복. 농장 현황은 다른 아이콘 권고:
- 후보: `LayoutGrid` (평상과 같지만 색 분리 OK), `Grid3x3`, `MapPin`, `Home`
- 권고: **`Grid3x3`** (배치도 의미 + Map과 시각 분리)

### 3-5. 평상 현황 페이지 "관리하기 →" 버튼 추가

`app/dashboard/bbq-board/page.tsx` 헤더 우측에 추가:

```diff
<div className="flex items-center gap-2">
  {lastFetched && (...)}
  <button onClick={handleRefresh} ...>
    <RefreshCw .../>
  </button>
+ <Link
+   href="/dashboard/bbq"
+   className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent cursor-pointer transition-colors"
+ >
+   <Settings2 className="size-4" />
+   관리하기
+   <ArrowRight className="size-3.5" />
+ </Link>
</div>
```

---

## 4. Phase 2 — 옵션 (사용자 결정 시 별도 PR)

| 항목 | 사유 | 작업량 |
|---|---|---|
| 신규 RPC `get_farms_board()` (Q2=2 선택 시) | 보드 전용 최소 fetch + admin only + PIPA audit | 2h |
| 만료 임박 단계 분리 (1~3일 위급, 4~7일 경고) | KPI 세분화 | 1h |
| 농장 현황 페이지에 §이력 검색 섹션 (BBQ 패턴) | 과거 임대 검색 | 4h |
| Realtime 채널 (farm_rentals/memberships 구독) | 실시간 갱신 | 2h |

---

## 5. 검증 계획

### 5-1. tsc / build / lint
- `npx tsc --noEmit` 0
- `npm run build` 0

### 5-2. Playwright dev
- /dashboard/farms-board 진입 → KPI 5종 visible
- 매트릭스: A존 40 + B존 20 셀 visible
- 셀 클릭 → FarmDrawer 오픈
- "관리하기 →" 버튼 → /dashboard/farms 이동
- 검색: 임차인명 부분 일치 → 결과 갱신
- 사이드바: [일별 운영] 순서 (대시보드 / 농장현황 / 평상현황 / 신청관리 / 문의관리)

### 5-3. Playwright prod (배포 후)
- prod /dashboard/farms-board 접근 → 60 농장 매트릭스
- KPI "임대중 35" 표시 (DB 실측 일치)
- "관리하기 →" 클릭 → /dashboard/farms (기존 페이지)

### 5-4. ALL_NAV_HREFS active 매칭
- `/dashboard/farms-board` 진입 → "농장 현황" active + "농장 관리" inactive (prefix 충돌 검증)
- `/dashboard/farms` 진입 → "농장 관리" active + "농장 현황" inactive

---

## 6. 영향 / 회귀

| 영역 | 영향 |
|---|---|
| 기존 `/dashboard/farms` | 0 (변경 없음) |
| `useFarms()` 훅 | 0 (재사용만) |
| 평상 현황 페이지 | "관리하기 →" 버튼 1개 추가만 |
| 사이드바 IA V2 | dailyOpsNav 4 → 5 항목 (Miller 안전) + 라벨 1개 단축 |
| ALL_NAV_HREFS | 자동 갱신 + active 매칭 prefix 충돌 자동 처리 |
| DB | 0 (Q2=1 useFarms 재사용 시) |
| audit_logs | 0 (RPC 미신설 시) |

---

## 7. 7점 체크

| # | 결과 |
|---|---|
| #1 인증/권한 | admin only (layout.tsx) ✅ |
| #2 비정상 경로 | 빈 결과 / 검색 fallback ✅ |
| #5 비밀정보 | 변경 없음 ✅ |
| #6 런타임 | tsc/build/Playwright ✅ |

---

## 8. 롤백

| 시나리오 | 방법 | 소요 |
|---|---|---|
| 전체 롤백 | `git revert <c>` | 2m |
| 신규 페이지만 제거 | `app/dashboard/farms-board` 디렉토리 삭제 | 1m |
| 사이드바 순서 복원 | Sidebar.tsx 단독 revert | 1m |

---

## 9. 커밋 전략

### 권고: 분리 3 커밋
1. `feat(farms-board): 농장 현황 페이지 신규 (매트릭스 + KPI + 검색)`
2. `feat(sidebar): [일별 운영] 순서 변경 + "평상 현황" 라벨 단축`
3. `feat(bbq-board): "관리하기 →" 버튼 추가 (관리 이동 동선)`

→ 1+3 묶어도 OK. 사이드바는 별도.

---

## 10. 작업량

| 항목 | 시간 |
|---|---|
| FarmsBoardPage + KPI + Matrix | 2h |
| Sidebar 순서 변경 + 라벨 단축 | 20m |
| bbq-board 관리하기 버튼 | 15m |
| tsc/build/Playwright dev | 45m |
| 커밋 + push + prod 배포 + 검증 | 1h |
| **합계** | **~4.5h** |

---

## 11. 잠재 리스크

| # | 항목 | 가능성 | 대응 |
|---|---|---|---|
| R1 | farms vs farms-board prefix active 매칭 충돌 | LOW | Sidebar.tsx 의 `moreSpecific` 분기 자동 처리. Playwright spec 1건 |
| R2 | useFarms 무거운 fetch (zone + rental + orders) | LOW | Phase 2 RPC 분리 |
| R3 | FarmDrawer 재활용 시 onUpdated 동작 | LOW | 기존 시그니처 동일 (farm + onClose + onUpdated) |
| R4 | 만료 임박 7일 임계 부적합 | LOW | 1주 burn-in 후 조정 |
| R5 | 모바일 매트릭스 가로 스크롤 | MID | overflow-x-auto + 모바일 viewport 검증 |
| R6 | 라벨 단축 "평상 예약 현황" → "평상 현황" 으로 E2E spec 변경 필요 | 확실 | `e2e/qa-prod-validation.spec.ts` 갱신 |

---

## 12. kk 피드백 (kk 직접 메모)

> 2026-05-16 17:45 kk 답변: "q4는 30일, 나머지는 권고대로"

- **Q1 (통합 안)**: **A** (신규 페이지 + 기존 /farms 보존)
- **Q2 (데이터 source)**: **1** (useFarms 재사용, Phase 2 RPC 마이그레이션 검토)
- **Q3 (라벨 단축)**: **a** ("평상 예약 현황" → "평상 현황")
- **Q4 (만료 임박 임계)**: **iii (30일)** — 권고 7일 → kk 변경 (운영 미리 알림이 유효)
- **Q5 (관리 버튼 디자인)**: **1** (outlined + Settings2 + ArrowRight)

✅ 승인 → 즉시 `/implement` 진입. Q4 임계 30일 반영.

---

## 13. 참조

- 리서치: `thoughts/research/20260516-1700_farms_board_and_management_pivot_research.md`
- 평상 보드 패턴: `app/dashboard/bbq-board/page.tsx`
- 평상 통합 패턴: `thoughts/plans/20260516-0100_bbq_consolidation_plan.md`
- 농장 관리 페이지: `app/dashboard/farms/page.tsx`
- useFarms: `lib/use-data.ts:237-276`
- FarmDrawer: `components/farms/FarmDrawer.tsx`
- DB: `supabase/migrations/002_farms.sql`, `013_farm_zones.sql`, `063_member_lifecycle.sql`
- Cloudbeds Reservations Tab — UX 패턴
- Shopify Admin Navigation
- Stripe Dashboard Settings 분리

---

## 14. END — kk Q1~Q5 답변 후 `/implement farms-board-pivot` 진입. 미승인 상태에서 구현 금지.
