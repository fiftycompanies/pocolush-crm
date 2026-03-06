'use client';

import { Search } from 'lucide-react';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import { TYPE_OPTIONS, STATUS_OPTIONS } from '@/lib/constants';

interface InquiryFiltersProps {
  typeFilter: string;
  statusFilter: string;
  search: string;
  onTypeChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

const typeTabs = [
  { value: '', label: '전체' },
  ...TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
];

export default function InquiryFilters({
  typeFilter,
  statusFilter,
  search,
  onTypeChange,
  onStatusChange,
  onSearchChange,
}: InquiryFiltersProps) {
  return (
    <div className="space-y-4">
      <Tabs tabs={typeTabs} value={typeFilter} onChange={onTypeChange} />
      <div className="flex items-center gap-3">
        <Select
          options={STATUS_OPTIONS}
          placeholder="상태 전체"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-40"
        />
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="이름·연락처 검색..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-bg-input border border-border-input rounded-[10px] pl-9 pr-3.5 py-2.5 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_#DCFCE7] transition-all w-56"
          />
        </div>
      </div>
    </div>
  );
}
