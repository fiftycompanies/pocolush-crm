'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ServiceOrderPhoto } from '@/types';

export default function OrderPhotoGallery({ photos }: { photos: ServiceOrderPhoto[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setActiveIdx(null), []);
  const showPrev = useCallback(
    () => setActiveIdx(i => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length]
  );
  const showNext = useCallback(
    () => setActiveIdx(i => (i === null ? null : (i + 1) % photos.length)),
    [photos.length]
  );

  // 키보드 조작 (Esc/←/→)
  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    // 배경 스크롤 락
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIdx, closeLightbox, showPrev, showNext]);

  const active = activeIdx !== null ? photos[activeIdx] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveIdx(i)}
            className="relative aspect-square rounded-xl overflow-hidden bg-bg-muted border border-border hover:border-text-tertiary transition-colors"
            aria-label={p.caption ? `사진: ${p.caption}` : `결과물 사진 ${i + 1}`}
          >
            <Image
              src={p.display_url}
              alt={p.caption ?? `결과물 ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover"
              unoptimized
            />
            {p.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-[10px] text-white line-clamp-2">{p.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 라이트박스 */}
      {active && activeIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>

          {/* 이전 */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showPrev(); }}
              className="absolute left-2 sm:left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="이전 사진"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {/* 이미지 */}
          <div
            className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative" style={{ maxWidth: '90vw', maxHeight: '75vh' }}>
              {/* 사용자 업로드이므로 Image 대신 img 사용 (크기 미지정 허용) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.display_url}
                alt={active.caption ?? '결과물 사진'}
                className="max-w-[90vw] max-h-[75vh] w-auto h-auto object-contain rounded-lg"
              />
            </div>
            {(active.caption || photos.length > 1) && (
              <div className="mt-3 text-center text-white text-xs space-y-1">
                {active.caption && <p className="px-4">{active.caption}</p>}
                {photos.length > 1 && (
                  <p className="text-white/60">{activeIdx + 1} / {photos.length}</p>
                )}
              </div>
            )}
          </div>

          {/* 다음 */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              className="absolute right-2 sm:right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="다음 사진"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
