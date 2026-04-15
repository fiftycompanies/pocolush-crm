'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, ChevronDown, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import FarmMap from '@/components/farms/FarmMap';
import FarmDrawer from '@/components/farms/FarmDrawer';
import FarmAddModal from '@/components/farms/FarmAddModal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { FARM_STATUS } from '@/lib/constants';
import { useFarms } from '@/lib/use-data';
import { createClient } from '@/lib/supabase/client';
import ExportButton from '@/components/ui/ExportButton';
import toast from 'react-hot-toast';
import type { Farm, FarmZone } from '@/types';

export default function FarmsPage() {
  const { data: farms, zones, pendingOrders, refetch: fetchFarms } = useFarms();
  const supabase = createClient();
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneDesc, setZoneDesc] = useState('');
  const [savingZone, setSavingZone] = useState(false);
  const [editingZone, setEditingZone] = useState<FarmZone | null>(null);
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set());
  const [addToZoneId, setAddToZoneId] = useState<string | null>(null);

  const handleFarmClick = (farm: Farm) => {
    setSelectedFarm(farm);
    setDrawerOpen(true);
  };

  const toggleZone = (zoneId: string) => {
    setCollapsedZones(prev => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId); else next.add(zoneId);
      return next;
    });
  };

  const handleAddZone = async () => {
    if (!zoneName.trim()) { toast.error('존 이름을 입력해주세요.'); return; }
    setSavingZone(true);
    const sortOrder = zones.length > 0 ? Math.max(...zones.map(z => z.sort_order)) + 1 : 1;

    if (editingZone) {
      const { error } = await supabase.from('farm_zones').update({
        name: zoneName.trim(), description: zoneDesc.trim() || null,
      }).eq('id', editingZone.id);
      if (error) toast.error('수정 실패'); else toast.success('존이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('farm_zones').insert({
        name: zoneName.trim(), description: zoneDesc.trim() || null, sort_order: sortOrder,
      });
      if (error) toast.error('존 추가 실패'); else toast.success('존이 추가되었습니다.');
    }
    setSavingZone(false);
    setAddZoneOpen(false);
    setEditingZone(null);
    setZoneName('');
    setZoneDesc('');
    fetchFarms();
  };

  const handleDeleteZone = async (zone: FarmZone) => {
    const zoneFarms = farms.filter(f => f.zone_id === zone.id);
    if (zoneFarms.length > 0) {
      toast.error(`"${zone.name}"에 ${zoneFarms.length}개 사이트가 있어 삭제할 수 없습니다.`);
      return;
    }
    if (!confirm(`"${zone.name}" 존을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('farm_zones').delete().eq('id', zone.id);
    if (error) toast.error('삭제 실패'); else { toast.success('존이 삭제되었습니다.'); fetchFarms(); }
  };

  const openEditZone = (zone: FarmZone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneDesc(zone.description || '');
    setAddZoneOpen(true);
  };

  const totalSites = farms.length;
  const zoneCount = zones.length;

  // 존에 속하지 않은 농장 (마이그레이션 이전 데이터 대응)
  const unzonedFarms = farms.filter(f => !zones.find(z => z.id === f.zone_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">농장 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">전체 {totalSites}구좌 · {zoneCount}개 존</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="farms" />
          <Button onClick={() => { setEditingZone(null); setZoneName(''); setZoneDesc(''); setAddZoneOpen(true); }} variant="secondary">
            + 존 추가
          </Button>
          <Button onClick={() => { setAddToZoneId(zones[0]?.id || null); setAddModalOpen(true); }} variant="primary">
            + 사이트 추가
          </Button>
        </div>
      </div>

      {/* 존 추가/수정 폼 */}
      {addZoneOpen && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">{editingZone ? '존 수정' : '새 존 추가'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="존 이름 (예: A존) *"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <input type="text" value={zoneDesc} onChange={e => setZoneDesc(e.target.value)} placeholder="설명 (선택)"
              className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddZone} disabled={savingZone}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40">
              {savingZone ? '저장 중...' : editingZone ? '수정' : '추가'}
            </button>
            <button onClick={() => { setAddZoneOpen(false); setEditingZone(null); }}
              className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary">취소</button>
          </div>
        </div>
      )}

      {/* 배치도 */}
      <FarmMap farms={farms} zones={zones} pendingOrders={pendingOrders} onFarmClick={handleFarmClick} />

      {/* 존별 테이블 */}
      {zones.map(zone => {
        const zoneFarms = farms.filter(f => f.zone_id === zone.id).sort((a, b) => a.number - b.number);
        const isCollapsed = collapsedZones.has(zone.id);

        return (
          <div key={zone.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {/* 존 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
              <button onClick={() => toggleZone(zone.id)} className="flex items-center gap-2 hover:text-primary">
                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                <span className="text-sm font-bold">{zone.name}</span>
                <span className="text-xs text-muted-foreground">({zoneFarms.length}구좌)</span>
                {zone.description && <span className="text-xs text-muted-foreground ml-1">— {zone.description}</span>}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => { setAddToZoneId(zone.id); setAddModalOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5">
                  <Plus className="size-3" /> 사이트
                </button>
                <button onClick={() => openEditZone(zone)} className="p-1.5 hover:bg-accent rounded-md">
                  <Edit3 className="size-3.5 text-text-secondary" />
                </button>
                <button onClick={() => handleDeleteZone(zone)} className="p-1.5 hover:bg-accent rounded-md">
                  <Trash2 className="size-3.5 text-red" />
                </button>
              </div>
            </div>

            {/* 존 테이블 */}
            {!isCollapsed && (
              <div className="overflow-x-auto">
                {zoneFarms.length === 0 ? (
                  <p className="text-center text-sm text-text-tertiary py-6">사이트가 없습니다.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left px-5 py-2 font-medium">번호</th>
                        <th className="text-left px-5 py-2 font-medium">이름</th>
                        <th className="text-left px-5 py-2 font-medium">면적(평)</th>
                        <th className="text-left px-5 py-2 font-medium">상태</th>
                        <th className="text-left px-5 py-2 font-medium">임차인</th>
                        <th className="text-left px-5 py-2 font-medium">기간</th>
                        <th className="text-left px-5 py-2 font-medium">만료일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {zoneFarms.map(farm => {
                        const statusMeta = FARM_STATUS[farm.status] || FARM_STATUS.available;
                        const rental = farm.current_rental;
                        return (
                          <tr key={farm.id} onClick={() => handleFarmClick(farm)}
                            className="hover:bg-muted/20 cursor-pointer transition-all">
                            <td className="px-5 py-2 font-medium">{farm.number}번</td>
                            <td className="px-5 py-2">{farm.name}</td>
                            <td className="px-5 py-2 text-muted-foreground">{farm.area_pyeong}평</td>
                            <td className="px-5 py-2">
                              <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
                            </td>
                            <td className="px-5 py-2">{rental?.customer?.name || '-'}</td>
                            <td className="px-5 py-2 text-muted-foreground text-xs">
                              {rental ? `${format(new Date(rental.start_date), 'yy.M.d')} ~` : '-'}
                            </td>
                            <td className="px-5 py-2 text-muted-foreground text-xs">
                              {rental ? format(new Date(rental.end_date), 'yy.M.d') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 미분류 농장 */}
      {unzonedFarms.length > 0 && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-yellow-50 border-b">
            <span className="text-sm font-bold text-yellow-700">미분류 ({unzonedFarms.length}구좌)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-5 py-2 font-medium">번호</th>
                  <th className="text-left px-5 py-2 font-medium">이름</th>
                  <th className="text-left px-5 py-2 font-medium">면적(평)</th>
                  <th className="text-left px-5 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {unzonedFarms.map(farm => {
                  const statusMeta = FARM_STATUS[farm.status] || FARM_STATUS.available;
                  return (
                    <tr key={farm.id} onClick={() => handleFarmClick(farm)} className="hover:bg-muted/20 cursor-pointer">
                      <td className="px-5 py-2 font-medium">{farm.number}번</td>
                      <td className="px-5 py-2">{farm.name}</td>
                      <td className="px-5 py-2 text-muted-foreground">{farm.area_pyeong}평</td>
                      <td className="px-5 py-2"><Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        farms={farms}
        zones={zones}
        defaultZoneId={addToZoneId}
      />
    </div>
  );
}
