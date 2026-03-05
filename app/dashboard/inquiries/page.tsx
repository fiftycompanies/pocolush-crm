'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import InquiryTable from '@/components/inquiries/InquiryTable';
import InquiryFilters from '@/components/inquiries/InquiryFilters';
import InquiryDrawer from '@/components/inquiries/InquiryDrawer';
import type { Inquiry } from '@/types';

export default function InquiriesPage() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchInquiries = useCallback(async () => {
    let query = supabase
      .from('inquiries')
      .select('*, customer:customers(*), assignee:profiles(*)')
      .order('created_at', { ascending: false });

    if (typeFilter) query = query.eq('type', typeFilter);
    if (statusFilter) query = query.eq('status', statusFilter);

    const { data } = await query;

    let filtered = data || [];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (inq) =>
          inq.customer?.name?.toLowerCase().includes(s) ||
          inq.customer?.phone?.includes(s)
      );
    }

    setInquiries(filtered);
  }, [supabase, typeFilter, statusFilter, search]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Open drawer from URL param
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
          <h1 className="text-2xl font-bold text-text-primary">문의 관리</h1>
          <p className="text-sm text-text-muted mt-1">전체 {inquiries.length}건</p>
        </div>
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
        onUpdate={fetchInquiries}
      />
    </div>
  );
}
