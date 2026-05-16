'use client';

/**
 * /dashboard/farms-board 전용 데이터 훅 (2026-05-16)
 *
 * 배경:
 *   - useFarms() 는 4 Promise.all (farms_active + farm_rentals + farm_zones_active + service_orders)
 *   - 농장 보드는 service_orders 불필요 + admin only + PIPA audit 필요
 *
 * 변경:
 *   - get_farms_board() RPC (마이그 085) 단일 호출
 *   - 4 round trip → 1
 *   - admin only (assert_admin_with_audit 078) + 1h dedup (079 패턴)
 *
 * 영향:
 *   - /farms (관리 페이지) 0 — useFarms 그대로 유지
 *   - FarmsBoardKpi/Matrix/FarmDrawer 0 — 동일 Farm/FarmZone 입력
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Customer, Farm, FarmRental, FarmZone } from '@/types';

export interface FarmBoardRow {
  farm_id: string;
  farm_number: number;
  farm_name: string;
  area_pyeong: number;
  zone_id: string | null;
  zone_name: string | null;
  zone_sort_order: number | null;
  zone_is_operational: boolean | null;
  rental_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  rental_plan: string | null;
  rental_start_date: string | null;
  rental_end_date: string | null;
  monthly_fee: number | null;
  payment_status: string | null;
  rental_status: string | null;
}

/**
 * RPC FarmBoardRow → 기존 Farm + FarmZone 도메인 객체로 매핑.
 * FarmsBoardKpi/Matrix 컴포넌트가 기존 Farm/FarmZone 타입 사용하므로 호환 유지.
 */
function mapToDomain(rows: FarmBoardRow[]): {
  farms: Farm[];
  zones: FarmZone[];
} {
  const zoneMap = new Map<string, FarmZone>();
  const farms: Farm[] = rows.map((r) => {
    if (r.zone_id && !zoneMap.has(r.zone_id)) {
      zoneMap.set(r.zone_id, {
        id: r.zone_id,
        name: r.zone_name ?? '',
        description: null,
        sort_order: r.zone_sort_order ?? 0,
        is_active: true,
        is_operational: r.zone_is_operational ?? false,
        created_at: '',
      });
    }
    const farm: Farm = {
      id: r.farm_id,
      number: r.farm_number,
      name: r.farm_name,
      area_pyeong: Number(r.area_pyeong ?? 0),
      area_sqm: Number(r.area_pyeong ?? 0) * 3.30579,
      status: r.rental_id ? 'rented' : 'available',
      zone_id: r.zone_id ?? '',
      position_x: 0,
      position_y: 0,
      created_at: '',
    };
    if (r.rental_id) {
      const customer: Customer = {
        id: r.customer_id ?? '',
        name: r.customer_name ?? '',
        phone: r.customer_phone ?? '',
        created_at: '',
      };
      const rental: FarmRental & { customer: Customer } = {
        id: r.rental_id,
        farm_id: r.farm_id,
        customer_id: r.customer_id ?? '',
        plan: (r.rental_plan as FarmRental['plan']) ?? undefined,
        start_date: r.rental_start_date ?? '',
        end_date: r.rental_end_date ?? '',
        monthly_fee: r.monthly_fee ?? 0,
        payment_method: '계좌이체',
        payment_status:
          (r.payment_status as FarmRental['payment_status']) ?? '대기',
        status: (r.rental_status as FarmRental['status']) ?? 'active',
        created_at: '',
        updated_at: '',
        customer,
      };
      farm.current_rental = rental;
    }
    return farm;
  });

  const zones = Array.from(zoneMap.values()).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return { farms, zones };
}

export function useFarmsBoard() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_farms_board');
    if (error || !data) {
      setLoading(false);
      return;
    }
    const { farms: f, zones: z } = mapToDomain(data as FarmBoardRow[]);
    setFarms(f);
    setZones(z);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { farms, zones, loading, refetch };
}
