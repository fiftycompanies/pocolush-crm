'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Edit3, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAdminNotices } from '@/lib/use-admin-member-data';
import { NOTICE_CATEGORIES } from '@/lib/member-constants';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { NoticeCategory } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

export default function AdminNoticesPage() {
  const { notices, loading, refetch } = useAdminNotices();
  const supabase = createClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const togglePublish = async (id: string, published: boolean) => {
    const update: Record<string, unknown> = { is_published: !published };
    if (!published) update.published_at = new Date().toISOString();
    else update.published_at = null;
    const { error } = await supabase.from('notices').update(update).eq('id', id);
    if (error) { toast.error('변경에 실패했습니다.'); return; }
    toast.success(published ? '발행 취소됨' : '발행됨');
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('notices').delete().eq('id', id);
    toast.success('삭제되었습니다.');
    refetch();
    setDeleting(null);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-bold text-text-primary tracking-tight">공지 관리</h1>
        <p className="text-sm text-text-secondary mt-1">전체 {notices.length}건</p></div>
        <div className="flex items-center gap-2">
          <ExportButton target="notices" dateField="created_at" />
          <Link href="/dashboard/notices/new" className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
            <Plus className="size-4" /> 새 공지
          </Link>
        </div>
      </div>

      {loading ? <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p> : notices.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">공지사항이 없습니다.</p></div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-medium text-text-secondary">제목</th>
            <th className="px-4 py-3 font-medium text-text-secondary">카테고리</th>
            <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
            <th className="px-4 py-3 font-medium text-text-secondary">작성일</th>
            <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
          </tr></thead><tbody>
            {notices.map(n => {
              const cat = NOTICE_CATEGORIES[n.category as NoticeCategory];
              return (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium text-text-primary">{n.title}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat?.bg }}>{cat?.label}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${n.is_published ? 'text-green bg-green-light' : 'text-gray bg-gray-light'}`}>{n.is_published ? '발행' : '미발행'}</span></td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{new Date(n.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => togglePublish(n.id, n.is_published)} className="p-1.5 hover:bg-accent rounded-md" title={n.is_published ? '발행 취소' : '발행'}>
                        {n.is_published ? <EyeOff className="size-3.5 text-text-secondary" /> : <Eye className="size-3.5 text-green" />}
                      </button>
                      <Link href={`/dashboard/notices/${n.id}/edit`} className="p-1.5 hover:bg-accent rounded-md"><Edit3 className="size-3.5 text-text-secondary" /></Link>
                      <button onClick={() => handleDelete(n.id)} disabled={deleting === n.id} className="p-1.5 hover:bg-accent rounded-md"><Trash2 className="size-3.5 text-red" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
