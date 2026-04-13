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
import ExportButton from '@/components/ui/ExportButton';
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
          <h1 className="text-2xl font-bold tracking-tight">농장 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">전체 {farms.length}개 농장</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="farms" />
          <Button onClick={() => setAddModalOpen(true)} variant="primary">
            + 농장 추가
          </Button>
        </div>
      </div>

      <FarmMap farms={farms} onFarmClick={handleFarmClick} />

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left px-6 py-2 font-medium">번호</th>
                <th className="text-left px-6 py-2 font-medium">이름</th>
                <th className="text-left px-6 py-2 font-medium">면적(평)</th>
                <th className="text-left px-6 py-2 font-medium">면적(m²)</th>
                <th className="text-left px-6 py-2 font-medium">상태</th>
                <th className="text-left px-6 py-2 font-medium">임차인</th>
                <th className="text-left px-6 py-2 font-medium">만료일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {farms.map((farm) => {
                const statusMeta = FARM_STATUS[farm.status] || FARM_STATUS.available;
                const rental = farm.current_rental;
                return (
                  <tr
                    key={farm.id}
                    onClick={() => handleFarmClick(farm)}
                    className="hover:bg-muted/20 cursor-pointer transition-all"
                  >
                    <td className="px-6 py-2 font-medium">{farm.number}</td>
                    <td className="px-6 py-2">{farm.name}</td>
                    <td className="px-6 py-2 text-muted-foreground">{farm.area_pyeong}</td>
                    <td className="px-6 py-2 text-muted-foreground">{farm.area_sqm}</td>
                    <td className="px-6 py-2">
                      <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                    </td>
                    <td className="px-6 py-2">
                      {rental?.customer?.name || '-'}
                    </td>
                    <td className="px-6 py-2 text-muted-foreground">
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
