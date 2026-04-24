'use client';

/**
 * 자람터 주말농장 이용 가이드 모달 (Phase 0.5 PR-H2)
 *
 * UX 결정사항 (C 리서치):
 * - 모바일: bottom-sheet (full-screen)
 * - 데스크톱: centered dialog (max-w-3xl, 80vh)
 * - z-[60]: MemberNav(z-50) 위 배치 (E QA BL-1 해결)
 * - focus trap + ESC + 배경 클릭 닫기
 * - sticky header + sticky footer (다운로드 버튼)
 * - prefers-reduced-motion 대응
 * - 닫을 때 트리거 요소로 포커스 복귀
 *
 * 사용처:
 * - app/m/signup/page.tsx (회원가입 "이용가이드 보기" 링크)
 * - app/member/page.tsx (마이페이지 4번째 카드)
 *
 * 다운로드 URL: NEXT_PUBLIC_GUIDE_PDF_URL env (Vercel 등록됨)
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { GuideContent, GUIDE_TITLE, GUIDE_VERSION } from '@/content/guide';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_PDF_URL = process.env.NEXT_PUBLIC_GUIDE_PDF_URL;

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // ESC 닫기 + body scroll lock + focus trap + 포커스 복귀
  useEffect(() => {
    if (!isOpen) return;

    // 모달 열린 시점의 포커스 요소 기억 (닫을 때 복귀)
    triggerRef.current = document.activeElement as HTMLElement | null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // 간단 focus trap: Tab 시 modal 내부로 순환
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    // 초기 포커스를 닫기 버튼에 (스크린리더 안내)
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      // 포커스 복귀
      triggerRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: 'easeOut' as const };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 배경 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* 모달 컨테이너 */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-modal-title"
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none"
          >
            <motion.div
              ref={contentRef}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
              transition={transition}
              className="bg-white w-full sm:max-w-3xl h-[92vh] sm:h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-white sticky top-0 rounded-t-2xl">
                <div className="min-w-0 flex-1">
                  <h2
                    id="guide-modal-title"
                    className="text-base sm:text-lg font-bold text-forest truncate"
                  >
                    {GUIDE_TITLE}
                  </h2>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    {GUIDE_VERSION} · 2026년 가입 회원용
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="가이드 닫기"
                  className="shrink-0 size-11 inline-flex items-center justify-center rounded-lg text-text-secondary hover:bg-accent active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </header>

              {/* 본문 스크롤 */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <GuideContent />
              </div>

              {/* Sticky footer 다운로드 */}
              <footer className="px-5 py-3 border-t border-border bg-white sticky bottom-0 rounded-b-2xl">
                {GUIDE_PDF_URL ? (
                  <a
                    href={GUIDE_PDF_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-center gap-2 w-full h-11 bg-forest hover:bg-forest-light active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="자람터 이용가이드 PDF 다운로드"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    PDF 다운로드
                  </a>
                ) : (
                  <p className="text-center text-xs text-text-tertiary py-2">
                    PDF 다운로드 링크 준비 중
                  </p>
                )}
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
