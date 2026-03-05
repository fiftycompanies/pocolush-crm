'use client';

import Select from '@/components/ui/Select';
import { TYPE_OPTIONS, STATUS_OPTIONS } from '@/lib/constants';

interface InquiryFiltersProps {
  typeFilter: string;
  statusFilter: string;
  search: string;
  onTypeChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export default function InquiryFilters({
  typeFilter,
  statusFilter,
  search,
  onTypeChange,
  onStatusChange,
  onSearchChange,
}: InquiryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        options={TYPE_OPTIONS}
        placeholder="서비스 전체"
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
      />
      <Select
        options={STATUS_OPTIONS}
        placeholder="상태 전체"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
      />
      <input
        type="text"
        placeholder="이름·연락처 검색..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors w-48"
      />
    </div>
  );
}
