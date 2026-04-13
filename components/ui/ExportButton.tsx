'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import { downloadExcel } from '@/lib/excel';

interface ExportButtonProps {
  target: string;
  params?: Record<string, string>;
  label?: string;
}

export default function ExportButton({
  target,
  params,
  label = '엑셀',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await downloadExcel(target, params);
      toast.success('다운로드 완료');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={handleClick}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
