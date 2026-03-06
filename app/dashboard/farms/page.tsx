'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import FarmMap from '@/components/farms/FarmMap';
import FarmDrawer from '@/components/farms/FarmDrawer';
import FarmAddModal from '@/components/farms/FarmAddModal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { FARM_STATUS } from '@/lib/constants';
import { useFarms } from '@/lib/use-data';
import type { Farm } from '@/types';

export default function FarmsPage() {
  const { data: farms, refetch: fetchFarms } = useFarms();
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleFarmClick = (farm: Farm) => {
    setSelectedFarm(farm);
    setDrawerOpen(true);
  };

  const nextNumber = farms.length > 0 ? Math.max(...farms.map((f) => f.number)) + 1 : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary">농장 관리</h1>
          <p className="text-[14px] text-text-secondary mt-1">전체 {farms.length}개 농장</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} variant="primary">
          + 농장 추가
        </Button>
      </div>

      <FarmMap farms={farms} onFarmClick={handleFarmClick} />

      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-page">
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">번호</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">이름</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">면적(평)</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">면적(m²)</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">상태</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">임차인</th>
                <th className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium">만료일</th>
              </tr>
            </thead>
            <tbody>
              {farms.map((farm) => {
                const statusMeta = FARM_STATUS[farm.status] || FARM_STATUS.available;
                const rental = farm.current_rental;
                return (
                  <tr
                    key={farm.id}
                    onClick={() => handleFarmClick(farm)}
                    className="border-b border-[#F3F4F6] hover:bg-bg-page cursor-pointer transition-colors h-[56px]"
                  >
                    <td className="px-4 py-3 text-[14px] text-primary font-bold">{farm.number}</td>
                    <td className="px-4 py-3 text-[14px] text-text-primary">{farm.name}</td>
                    <td className="px-4 py-3 text-[14px] text-text-secondary">{farm.area_pyeong}</td>
                    <td className="px-4 py-3 text-[14px] text-text-secondary">{farm.area_sqm}</td>
                    <td className="px-4 py-3">
                      <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                    </td>
                    <td className="px-4 py-3 text-[14px] text-text-primary">
                      {rental?.customer?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-text-tertiary">
                      {rental ? format(new Date(rental.end_date), 'yy.M.d') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FarmDrawer
        farm={selectedFarm}
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedFarm(null); }}
        onUpdate={fetchFarms}
      />

      <FarmAddModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={fetchFarms}
        nextNumber={nextNumber}
      />
    </div>
  );
}
