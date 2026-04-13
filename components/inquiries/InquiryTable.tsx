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
import { MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
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
          <span className="font-medium text-sm">{info.getValue()}</span>
        ),
        size: 120,
      }),
      columnHelper.accessor((row) => row.customer?.phone ?? '-', {
        id: 'customerPhone',
        header: '연락처',
        cell: (info) => (
          <span className="text-muted-foreground text-sm">{info.getValue()}</span>
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
          <span className="text-muted-foreground text-sm">{info.getValue()}</span>
        ),
        size: 100,
      }),
      columnHelper.accessor('created_at', {
        header: '접수일시',
        cell: (info) => (
          <span className="text-muted-foreground text-xs">
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
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b text-muted-foreground">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-6 py-2 font-medium cursor-pointer hover:text-foreground transition-all"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ArrowUp className="size-3" />}
                      {header.column.getIsSorted() === 'desc' && <ArrowDown className="size-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/40">
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
                  className="hover:bg-muted/20 cursor-pointer transition-all"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-2">
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
