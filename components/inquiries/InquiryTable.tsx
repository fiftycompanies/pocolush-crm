'use client';

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import TypeBadge from './TypeBadge';
import StatusBadge from './StatusBadge';
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
          <span className="text-text-primary font-medium">{info.getValue()}</span>
        ),
        size: 120,
      }),
      columnHelper.accessor((row) => row.customer?.phone ?? '-', {
        id: 'customerPhone',
        header: '연락처',
        cell: (info) => (
          <span className="text-text-secondary">{info.getValue()}</span>
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
          <span className="text-text-secondary">{info.getValue()}</span>
        ),
        size: 100,
      }),
      columnHelper.accessor('created_at', {
        header: '접수일시',
        cell: (info) => (
          <span className="text-text-muted text-xs">
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
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-6 py-3 text-xs text-text-muted font-medium cursor-pointer hover:text-text-secondary transition-colors"
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
                <td colSpan={6} className="px-6 py-16 text-center text-text-muted text-sm">
                  해당하는 문의가 없습니다
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.original.id)}
                  className="border-b border-border/50 hover:bg-bg-hover cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-3 text-sm">
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
