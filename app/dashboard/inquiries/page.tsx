'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import InquiryTable from '@/components/inquiries/InquiryTable';
import InquiryFilters from '@/components/inquiries/InquiryFilters';
import InquiryDrawer from '@/components/inquiries/InquiryDrawer';
import { useInquiries } from '@/lib/use-data';
import ExportButton from '@/components/ui/ExportButton';

export default function InquiriesPage() {
  const searchParams = useSearchParams();

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: inquiries, refetch } = useInquiries({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      setSelectedId(openId);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  const handleRowClick = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">문의 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">총 {inquiries.length}건</p>
        </div>
        <ExportButton target="inquiries" params={{ type: typeFilter, status: statusFilter, search }} dateField="created_at" />
      </div>

      <InquiryFilters
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        search={search}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearch}
      />

      <InquiryTable data={inquiries} onRowClick={handleRowClick} />

      <InquiryDrawer
        inquiryId={selectedId}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedId(null);
        }}
        onUpdate={refetch}
      />
    </div>
  );
}
