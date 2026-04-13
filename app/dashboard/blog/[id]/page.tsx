'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: '나들이-가이드', label: '나들이 가이드' },
  { value: '주말농장', label: '주말농장' },
  { value: '행사-공간', label: '행사 공간' },
  { value: '포코러쉬-소식', label: '포코러쉬 소식' },
  { value: '자연-라이프', label: '자연 라이프' },
];

export default function BlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchPost = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setTitle(data.title || '');
      setSlug(data.slug || '');
      setCategory(data.category || '');
      setTags(data.tags || []);
      setThumbnail(data.thumbnail || '');
      setSeoDescription(data.seo_description || data.description || '');
      setContent(data.content || '');
      setIsPublished(data.is_published || false);
    } else {
      toast.error('글을 찾을 수 없습니다');
      router.push('/dashboard/blog');
    }
    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagsInput.trim().replace(/,/g, '');
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagsInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    if (!slug.trim()) {
      toast.error('슬러그를 입력해주세요');
      return;
    }

    setSaving(true);

    const updateData: Record<string, unknown> = {
      title: title.trim(),
      slug: slug.trim(),
      category: category || 'general',
      tags,
      thumbnail: thumbnail || null,
      description: seoDescription || null,
      seo_description: seoDescription || null,
      content: content || null,
      is_published: publish,
    };

    if (publish && !isPublished) {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabase.from('posts').update(updateData).eq('id', id);

    if (error) {
      toast.error(error.message.includes('duplicate') ? '이미 사용 중인 슬러그입니다' : '저장에 실패했습니다');
    } else {
      setIsPublished(publish);
      toast.success(publish ? '글이 발행되었습니다' : '임시저장되었습니다');
      router.push('/dashboard/blog');
    }
    setSaving(false);
  };

  const handleUnpublish = async () => {
    setSaving(true);
    const { error } = await supabase.from('posts').update({ is_published: false }).eq('id', id);
    if (error) {
      toast.error('발행 취소에 실패했습니다');
    } else {
      setIsPublished(false);
      toast.success('발행이 취소되었습니다');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('글이 삭제되었습니다');
      router.push('/dashboard/blog');
    }
    setDeleting(false);
    setDeleteOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ maxWidth: '1400px' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/blog')}
            className="text-muted-foreground hover:text-foreground transition-all size-8 flex items-center justify-center rounded-md hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 style={{ fontSize: '22px' }} className="font-bold text-text-primary tracking-tight">글 수정</h1>
          </div>
        </div>
        {isPublished && (
          <Button variant="secondary" size="sm" onClick={handleUnpublish} loading={saving}>
            발행 취소
          </Button>
        )}
      </div>

      <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
        {/* Editor */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="글 제목을 입력하세요"
                className="w-full border border-input rounded-md bg-transparent px-3 py-1 h-9 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">슬러그 (URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug"
                className="w-full border border-input rounded-md bg-transparent px-3 py-1 h-9 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">/blog/{slug || '...'}</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-input rounded-md bg-transparent px-3 py-1 h-9 text-sm text-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">선택하세요</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">태그</label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground ml-0.5">&times;</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="태그 입력 후 엔터"
                className="w-full border border-input rounded-md bg-transparent px-3 py-1 h-9 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>

            {/* Thumbnail */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">썸네일 URL</label>
              <input
                type="text"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://..."
                className="w-full border border-input rounded-md bg-transparent px-3 py-1 h-9 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>

            {/* SEO Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">SEO 설명</label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="검색 결과에 표시될 설명 (150자 이내 권장)"
                rows={2}
                className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">{seoDescription.length}/150</p>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">본문 (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="마크다운으로 본문을 작성하세요..."
                className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y font-mono"
                style={{ minHeight: '400px' }}
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => handleSave(false)} loading={saving}>
                  임시저장
                </Button>
                <Button variant="primary" onClick={() => handleSave(true)} loading={saving}>
                  발행하기
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
                삭제하기
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ width: '40%', minWidth: '320px' }}>
          <div className="bg-card rounded-xl border shadow-sm p-6 sticky" style={{ top: '80px' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">미리보기</p>
            <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
              {content ? (
                <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
              ) : (
                <p className="text-muted-foreground text-sm">본문을 작성하면 미리보기가 표시됩니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="글 삭제">
        <p className="text-sm text-muted-foreground mb-5">
          이 글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
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
