'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: '나들이-가이드', label: '나들이 가이드' },
  { value: '주말농장', label: '주말농장' },
  { value: '행사-공간', label: '행사 공간' },
  { value: '포코러쉬-소식', label: '포코러쉬 소식' },
  { value: '자연-라이프', label: '자연 라이프' },
];

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[가-힣]+/g, (match) => {
      const map: Record<string, string> = {
        '가': 'ga', '나': 'na', '다': 'da', '라': 'ra', '마': 'ma',
        '바': 'ba', '사': 'sa', '아': 'a', '자': 'ja', '차': 'cha',
        '카': 'ka', '타': 'ta', '파': 'pa', '하': 'ha',
      };
      return match.split('').map((c) => map[c] || c).join('');
    })
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function BlogNewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManual) {
      setSlug(toSlug(value));
    }
  };

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
    const { error } = await supabase.from('posts').insert({
      site_id: 'pocolush',
      title: title.trim(),
      slug: slug.trim(),
      category: category || 'general',
      tags,
      thumbnail: thumbnail || null,
      description: seoDescription || null,
      seo_description: seoDescription || null,
      content: content || null,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      author: 'POCOLUSH',
    });

    if (error) {
      toast.error(error.message.includes('duplicate') ? '이미 사용 중인 슬러그입니다' : '저장에 실패했습니다');
    } else {
      toast.success(publish ? '글이 발행되었습니다' : '임시저장되었습니다');
      router.push('/dashboard/blog');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1400px' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/blog')}
          className="text-muted-foreground hover:text-foreground transition-all size-8 flex items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 style={{ fontSize: '22px' }} className="font-bold text-text-primary tracking-tight">새 글 작성</h1>
        </div>
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
                onChange={(e) => handleTitleChange(e.target.value)}
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
                onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
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
            <div className="flex items-center gap-2 pt-2">
              <Button variant="secondary" onClick={() => handleSave(false)} loading={saving}>
                임시저장
              </Button>
              <Button variant="primary" onClick={() => handleSave(true)} loading={saving}>
                발행하기
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
    </div>
  );
}
