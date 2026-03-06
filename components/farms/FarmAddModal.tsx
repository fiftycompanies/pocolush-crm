'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface FarmAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  nextNumber: number;
}

export default function FarmAddModal({ isOpen, onClose, onAdded, nextNumber }: FarmAddModalProps) {
  const supabase = createClient();
  const [name, setName] = useState(`${nextNumber}번 농장`);
  const [area, setArea] = useState('3.0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !area) return;
    setSaving(true);

    const { error } = await supabase.from('farms').insert({
      number: nextNumber,
      name: name.trim(),
      area_pyeong: parseFloat(area),
      position_x: (nextNumber - 1) % 5,
      position_y: Math.floor((nextNumber - 1) / 5),
    });

    if (error) {
      toast.error('농장 추가 실패: ' + error.message);
    } else {
      toast.success('농장이 추가되었습니다');
      onAdded();
      onClose();
      setName(`${nextNumber + 1}번 농장`);
      setArea('3.0');
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="농장 추가">
      <div className="space-y-4">
        <Input label="농장 번호" value={String(nextNumber)} disabled />
        <Input label="농장 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="면적 (평)" type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} variant="primary" className="flex-1" loading={saving}>
          농장 추가
        </Button>
        <Button onClick={onClose} variant="secondary" className="flex-1">
          취소
        </Button>
      </div>
    </Modal>
  );
}
