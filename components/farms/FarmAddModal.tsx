'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { Farm, FarmZone } from '@/types';

interface FarmAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  farms: Farm[];
  zones?: FarmZone[];
  defaultZoneId?: string | null;
}

export default function FarmAddModal({ isOpen, onClose, onAdded, farms, zones = [], defaultZoneId }: FarmAddModalProps) {
  const supabase = createClient();
  const [zoneId, setZoneId] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('3.0');
  const [saving, setSaving] = useState(false);

  // 존별 다음 번호 계산
  const nextNumber = useMemo(() => {
    const zoneFarms = farms.filter(f => f.zone_id === zoneId);
    if (zoneFarms.length === 0) return 1;
    return Math.max(...zoneFarms.map(f => f.number)) + 1;
  }, [farms, zoneId]);

  // 번호 변경 시 이름 자동 갱신
  useEffect(() => {
    const zoneName = zones.find(z => z.id === zoneId)?.name || '';
    setName(`${zoneName ? zoneName + ' ' : ''}${nextNumber}번`);
  }, [nextNumber, zoneId, zones]);

  // 모달 열릴 때 존 리셋
  useEffect(() => {
    if (isOpen) {
      const id = defaultZoneId || zones[0]?.id || '';
      setZoneId(id);
      setArea('3.0');
    }
  }, [isOpen, defaultZoneId, zones]);

  const handleZoneChange = (newZoneId: string) => {
    setZoneId(newZoneId);
  };

  const handleSave = async () => {
    if (!name.trim() || !area || !zoneId) {
      toast.error('모든 필드를 입력해주세요.');
      return;
    }
    setSaving(true);

    const zoneFarms = farms.filter(f => f.zone_id === zoneId);
    const posIndex = zoneFarms.length;

    const { error } = await supabase.from('farms').insert({
      number: nextNumber,
      name: name.trim(),
      area_pyeong: parseFloat(area),
      zone_id: zoneId,
      position_x: posIndex % 5,
      position_y: Math.floor(posIndex / 5),
    });

    if (error) {
      toast.error('사이트 추가 실패: ' + error.message);
    } else {
      toast.success('사이트가 추가되었습니다');
      onAdded();
      onClose();
    }
    setSaving(false);
  };

  const selectedZone = zones.find(z => z.id === zoneId);
  const zoneFarmCount = farms.filter(f => f.zone_id === zoneId).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="사이트 추가">
      <div className="space-y-4">
        {zones.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">존 선택 *</label>
            <select value={zoneId} onChange={e => handleZoneChange(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
              {zones.map(z => {
                const count = farms.filter(f => f.zone_id === z.id).length;
                return (
                  <option key={z.id} value={z.id}>
                    {z.name} ({count}구좌){z.description ? ` — ${z.description}` : ''}
                  </option>
                );
              })}
            </select>
            {selectedZone && (
              <p className="text-[11px] text-text-tertiary mt-1">
                {selectedZone.name}에 현재 {zoneFarmCount}개 사이트 · 다음 번호: {nextNumber}번
              </p>
            )}
          </div>
        )}
        <Input label="사이트 번호" value={String(nextNumber)} disabled />
        <Input label="사이트 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="면적 (평)" type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} variant="primary" className="flex-1" loading={saving}>
          사이트 추가
        </Button>
        <Button onClick={onClose} variant="secondary" className="flex-1">
          취소
        </Button>
      </div>
    </Modal>
  );
}
