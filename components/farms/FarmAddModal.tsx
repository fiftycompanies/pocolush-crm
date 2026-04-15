'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { FarmZone } from '@/types';

interface FarmAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  nextNumber: number;
  zones?: FarmZone[];
  defaultZoneId?: string | null;
}

export default function FarmAddModal({ isOpen, onClose, onAdded, nextNumber, zones = [], defaultZoneId }: FarmAddModalProps) {
  const supabase = createClient();
  const [name, setName] = useState(`${nextNumber}번 농장`);
  const [area, setArea] = useState('3.0');
  const [zoneId, setZoneId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(`${nextNumber}번 농장`);
  }, [nextNumber]);

  // 모달이 열릴 때마다 defaultZoneId로 리셋
  useEffect(() => {
    if (isOpen) {
      setZoneId(defaultZoneId || zones[0]?.id || '');
    }
  }, [isOpen, defaultZoneId, zones]);

  const handleSave = async () => {
    if (!name.trim() || !area || !zoneId) {
      toast.error('모든 필드를 입력해주세요.');
      return;
    }
    setSaving(true);

    const { error } = await supabase.from('farms').insert({
      number: nextNumber,
      name: name.trim(),
      area_pyeong: parseFloat(area),
      zone_id: zoneId,
      position_x: (nextNumber - 1) % 5,
      position_y: Math.floor((nextNumber - 1) / 5),
    });

    if (error) {
      toast.error('농장 추가 실패: ' + error.message);
    } else {
      toast.success('사이트가 추가되었습니다');
      onAdded();
      onClose();
      setName(`${nextNumber + 1}번 농장`);
      setArea('3.0');
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="사이트 추가">
      <div className="space-y-4">
        {zones.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">존 선택 *</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}{z.description ? ` — ${z.description}` : ''}</option>
              ))}
            </select>
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
