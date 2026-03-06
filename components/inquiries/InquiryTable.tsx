'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';
import TypeBadge from './TypeBadge';
import StatusBadge from './StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import type { Inquiry } from '@/types';

interface InquiryTableProps {
  data: Inquiry[];
  onRowClick: (id: string) => void;
}

const columnHelper = createColumnHelper<Inquiry>();

export default function InquiryTable({ data, onRowClick }: InquiryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('type', {
        header: '유형',
        cell: (info) => <TypeBadge type={info.getValue()} />,
        size: 160,
      }),
      columnHelper.accessor((row) => row.customer?.name ?? '-', {
        id: 'customerName',
        header: '이름',
        cell: (info) => (
          <span className="text-text-primary font-medium text-[14px]">{info.getValue()}</span>
        ),
        size: 120,
      }),
      columnHelper.accessor((row) => row.customer?.phone ?? '-', {
        id: 'customerPhone',
        header: '연락처',
        cell: (info) => (
          <span className="text-text-secondary text-[14px]">{info.getValue()}</span>
        ),
        size: 140,
      }),
      columnHelper.accessor('status', {
        header: '상태',
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 100,
      }),
      columnHelper.accessor((row) => row.assignee?.name ?? '-', {
        id: 'assigneeName',
        header: '담당자',
        cell: (info) => (
          <span className="text-text-secondary text-[14px]">{info.getValue()}</span>
        ),
        size: 100,
      }),
      columnHelper.accessor('created_at', {
        header: '접수일시',
        cell: (info) => (
          <span className="text-text-tertiary text-[13px]">
            {format(new Date(info.getValue()), 'M/d HH:mm', { locale: ko })}
          </span>
        ),
        size: 100,
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-bg-page">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-4 py-3 text-[13px] text-text-secondary font-medium cursor-pointer hover:text-text-primary transition-colors h-[44px]"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && '↑'}
                      {header.column.getIsSorted() === 'desc' && '↓'}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={MessageSquare}
                    title="해당하는 문의가 없습니다"
                    description="필터 조건을 변경해보세요"
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.original.id)}
                  className="border-b border-[#F3F4F6] hover:bg-bg-page cursor-pointer transition-colors h-[56px]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-[14px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
