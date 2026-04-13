'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import { downloadExcel } from '@/lib/excel';

type Preset = 'today' | '1w' | '1m' | '3m' | 'all';

const PRESETS: { key: Preset; label: string; days: number | null }[] = [
  { key: 'today', label: '오늘', days: 0 },
  { key: '1w', label: '1주', days: 6 },
  { key: '1m', label: '1개월', days: 29 },
  { key: '3m', label: '3개월', days: 89 },
  { key: 'all', label: '전체', days: null },
];

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function calcFrom(days: number | null): string {
  if (days === null) return '';
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

interface ExportButtonProps {
  target: string;
  params?: Record<string, string>;
  label?: string;
  dateField?: string;
}

export default function ExportButton({
  target,
  params,
  label = '엑셀',
  dateField,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>('1w');
  const [from, setFrom] = useState(() => calcFrom(6));
  const [to, setTo] = useState(() => formatDate(new Date()));
  const popoverRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    const cfg = PRESETS.find((x) => x.key === p)!;
    setFrom(calcFrom(cfg.days));
    setTo(cfg.days === null ? '' : formatDate(new Date()));
  };

  const handleFromChange = (v: string) => {
    setFrom(v);
    setPreset('all'); // 커스텀 → 프리셋 해제 (실질적으로 커스텀 범위)
  };

  const handleToChange = (v: string) => {
    setTo(v);
    setPreset('all');
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const exportParams: Record<string, string> = { ...params };
      if (from) exportParams.from = from;
      if (to) exportParams.to = to;
      await downloadExcel(target, exportParams);
      toast.success('다운로드 완료');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setLoading(false);
    }
  };

  // dateField 없으면 즉시 다운로드 (farms, products)
  const handleClick = async () => {
    if (!dateField) {
      setLoading(true);
      try {
        await downloadExcel(target, params);
        toast.success('다운로드 완료');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '다운로드 실패');
      } finally {
        setLoading(false);
      }
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        variant="ghost"
        size="sm"
        loading={!dateField && loading}
        onClick={handleClick}
      >
        <Download className="size-4" />
        {label}
      </Button>

      {open && dateField && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-card border border-border rounded-xl shadow-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-text-secondary">기간 선택</p>

          {/* 프리셋 버튼 */}
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  preset === p.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent/40 text-text-secondary hover:bg-accent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 날짜 입력 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-transparent text-text-primary focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-text-tertiary">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => handleToChange(e.target.value)}
              className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-transparent text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* 다운로드 버튼 */}
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleDownload}
            className="w-full"
          >
            <Download className="size-3.5" />
            다운로드
          </Button>
        </div>
      )}
    </div>
  );
}
