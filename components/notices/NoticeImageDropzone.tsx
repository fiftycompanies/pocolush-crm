'use client';

/**
 * 공지 이미지 드롭존 (PR-H3)
 *
 * 기능:
 * - Drag & Drop + 파일 선택 버튼 (input[type=file][multiple])
 * - 5-state 시각 피드백 (idle/dragover/uploading/error)
 * - 썸네일 그리드 + 키보드 순서변경 ◀▶ (WCAG 2.1.1)
 * - 삭제 버튼, URL 복사 버튼
 * - 2MB / 10장 제한 사전 안내
 *
 * Accessibility:
 * - aria-label, aria-busy, aria-live
 * - 드롭존 fieldset + legend
 * - 썸네일 버튼 44pt 터치 타겟
 */

import { useCallback, useRef } from 'react';
import { Upload, X, ChevronLeft, ChevronRight, Copy, Loader2, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNoticeImageUpload } from '@/lib/use-notice-image-upload';
import type { UploadedNoticeImage } from '@/lib/upload-notice-image';

interface NoticeImageDropzoneProps {
  noticeId: string | null;
  onInsertMarkdown: (markdown: string) => void;
}

export default function NoticeImageDropzone({
  noticeId,
  onInsertMarkdown,
}: NoticeImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    images,
    state,
    progress,
    loading,
    setDragover,
    uploadFiles,
    removeImage,
    moveImage,
  } = useNoticeImageUpload(noticeId, {
    onUploaded: (img: UploadedNoticeImage) => {
      // 커서 위치에 ![alt](url) 삽입 — alt 는 빈값 (캡션 미입력 시 파일명 정보 없어 a11y 공백)
      const altText = img.caption || '';
      onInsertMarkdown(`\n![${altText}](${img.display_url})\n`);
    },
  });

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    uploadFiles(Array.from(list));
  }, [uploadFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles, setDragover]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(true);
  }, [setDragover]);

  const handleDragLeave = useCallback(() => setDragover(false), [setDragover]);

  const copyMarkdown = useCallback((img: UploadedNoticeImage) => {
    const md = `![${img.caption || ''}](${img.display_url})`;
    // clipboard API — HTTPS/secure context 에서만 동작. HTTP/iOS<13.4 는 execCommand fallback
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md).then(
        () => toast.success('마크다운 복사됨'),
        () => toast.error('복사 실패 — 수동 복사해주세요'),
      );
      return;
    }
    // fallback: textarea + execCommand (iOS Safari < 13.4, HTTP preview 환경)
    const ta = document.createElement('textarea');
    ta.value = md;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast.success('마크다운 복사됨');
    } catch {
      toast.error('복사 실패 — 수동 복사해주세요');
    } finally {
      ta.remove();
    }
  }, []);

  const disabled = !noticeId || state === 'uploading';
  const ringClass =
    state === 'dragover' ? 'border-primary bg-primary/5 scale-[1.01]'
    : state === 'uploading' ? 'border-primary bg-primary/5'
    : state === 'error' ? 'border-red-400 bg-red-50'
    : 'border-border bg-white hover:border-primary/40';

  return (
    <fieldset className="space-y-3" aria-busy={state === 'uploading'}>
      <legend className="text-xs font-medium text-text-primary mb-1">
        이미지 첨부 <span className="text-text-tertiary font-normal">(최대 10장, 2MB/장)</span>
      </legend>

      {/* 드롭존 */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="이미지 파일을 여기에 드롭하거나 클릭하여 선택"
        aria-disabled={disabled}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-xl px-4 py-8 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${ringClass} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {state === 'uploading' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-text-primary">
              업로드 중 ({progress.current}/{progress.total})
            </p>
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-red-700">업로드 일부 실패</p>
            <p className="text-[11px] text-red-600">다시 시도해주세요</p>
          </div>
        ) : state === 'dragover' ? (
          <div className="flex flex-col items-center gap-2">
            <Upload className="size-6 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-primary">여기에 놓으세요</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="size-6 text-text-secondary" aria-hidden="true" />
            <p className="text-sm text-text-primary">
              {noticeId
                ? <>이미지를 드래그하거나 <span className="text-primary font-medium">클릭</span>하여 선택</>
                : '공지를 먼저 저장(임시저장)하면 이미지 첨부가 가능합니다'}
            </p>
            <p className="text-[11px] text-text-tertiary">
              JPEG · PNG · WebP · 1장 최대 2MB · 자동 리사이즈(1600px)
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ''; // 동일 파일 재선택 허용
          }}
        />
      </div>

      {/* aria-live: 스크린리더 안내 */}
      <p className="sr-only" aria-live="polite">
        {state === 'uploading'
          ? `업로드 진행 ${progress.current} / ${progress.total}`
          : images.length > 0 ? `${images.length}장 첨부됨` : ''}
      </p>

      {/* 썸네일 그리드 */}
      {loading ? (
        <p className="text-[12px] text-text-tertiary">이미지 불러오는 중...</p>
      ) : images.length > 0 ? (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="list">
          {images.map((img, i) => (
            <li
              key={img.id}
              className="relative group rounded-lg overflow-hidden border border-border bg-white"
            >
              <div className="relative aspect-square">
                {/* next/image 가 아닌 img — Storage public URL 은 remotePatterns 미등록 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.display_url}
                  alt={img.caption || `공지 이미지 ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* 호버/포커스 컨트롤 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col justify-between p-1">
                {/* 상단: 삭제 + 복사 */}
                <div className="flex justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => copyMarkdown(img)}
                    aria-label={`${i + 1}번 이미지 마크다운 복사`}
                    className="size-10 inline-flex items-center justify-center rounded bg-white/90 hover:bg-white text-text-primary shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('이 이미지를 삭제할까요?')) removeImage(img.id);
                    }}
                    aria-label={`${i + 1}번 이미지 삭제`}
                    className="size-10 inline-flex items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* 하단: 순서 이동 */}
                <div className="flex justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveImage(img.id, 'left')}
                    aria-label={`${i + 1}번 이미지 왼쪽으로 이동`}
                    className="size-10 inline-flex items-center justify-center rounded bg-white/90 hover:bg-white text-text-primary shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white self-center">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    disabled={i === images.length - 1}
                    onClick={() => moveImage(img.id, 'right')}
                    aria-label={`${i + 1}번 이미지 오른쪽으로 이동`}
                    className="size-10 inline-flex items-center justify-center rounded bg-white/90 hover:bg-white text-text-primary shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

    </fieldset>
  );
}
