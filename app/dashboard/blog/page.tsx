'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, FileEdit, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import ExportButton from '@/components/ui/ExportButton';

interface Post {
  id: string;
  title: string;
  slug: string;
  category: string;
  is_published: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
}

export default function BlogListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, title, slug, category, is_published, view_count, published_at, created_at')
      .eq('site_id', 'pocolush')
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('posts').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('글이 삭제되었습니다');
      fetchPosts();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '22px' }} className="font-bold text-text-primary tracking-tight">블로그 관리</h1>
          <p style={{ fontSize: '14px' }} className="text-text-secondary mt-0.5">전체 {posts.length}건</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="blog" />
          <Button variant="primary" onClick={() => router.push('/dashboard/blog/new')}>
            <Plus className="size-4" />
            새 글 작성
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">제목</th>
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">카테고리</th>
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">상태</th>
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">조회수</th>
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">작성일</th>
                <th style={{ fontSize: '12px' }} className="text-left px-5 py-3 text-text-tertiary font-semibold uppercase tracking-wider">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <p style={{ fontSize: '14px' }} className="text-text-tertiary">불러오는 중...</p>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={FileEdit} title="블로그 글이 없습니다" description="새 글을 작성하여 블로그를 시작하세요" />
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-border-light hover:bg-bg-hover transition-colors duration-150"
                  >
                    <td className="px-5 py-3.5" style={{ fontSize: '14px', maxWidth: '320px' }}>
                      <span className="text-text-primary font-medium truncate block">{post.title}</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontSize: '14px' }}>
                      <span className="text-text-secondary">{post.category || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {post.is_published ? (
                        <Badge label="발행" color="#16A34A" bg="#F0FDF4" />
                      ) : (
                        <Badge label="임시저장" color="#64748B" bg="#F1F5F9" />
                      )}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontSize: '14px' }}>
                      <span className="text-text-secondary">{post.view_count}</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontSize: '14px' }}>
                      <span className="text-text-tertiary">
                        {format(new Date(post.created_at), 'yyyy.M.d', { locale: ko })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/blog/${post.id}`)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(post)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="글 삭제">
        <p className="text-sm text-muted-foreground mb-5">
          &ldquo;{deleteTarget?.title}&rdquo; 글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
            취소
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            삭제
          </Button>
        </div>
      </Modal>
    </div>
  );
}
