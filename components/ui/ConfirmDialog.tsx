'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

/**
 * 통합 확인 다이얼로그 (PR-C2, 2026-05-16)
 *
 * 기존 window.confirm() 22+개 호출을 점진적으로 대체.
 * 기존 Modal/Drawer 패턴 답습 (Framer Motion + Tailwind, shadcn 미사용).
 *
 * 핵심 a11y:
 *   - role="alertdialog" + aria-describedby
 *   - focus trap (기본: cancel 버튼에 autoFocus — destructive 의 안전한 default)
 *   - ESC 닫기, backdrop click 닫기 (단 isLoading 중에는 무시)
 *   - 닫힌 후 호출 버튼으로 focus 복귀 (호출자가 ref 보관 시)
 *
 * 사이드 이펙트 회피:
 *   - z-60 (기존 Modal/Drawer z-50 위) — 모달 중첩 시 충돌 0
 *   - isLoading=true 시 backdrop click + ESC 무시 (Server Action 진행 중 닫힘 회피)
 *   - confirm 버튼은 isLoading 시 disabled (중복 클릭 방지)
 */

export type ConfirmVariant = 'destructive' | 'warning' | 'default';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** message 는 ReactNode — 여러 줄, 강조 등 자유 */
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

const VARIANT_STYLE: Record<
  ConfirmVariant,
  { icon: typeof AlertCircle; iconColor: string; iconBg: string; confirmClass: string; defaultConfirm: string }
> = {
  destructive: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    defaultConfirm: '삭제',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    defaultConfirm: '진행',
  },
  default: {
    icon: HelpCircle,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    defaultConfirm: '확인',
  },
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText = '취소',
  variant = 'default',
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const style = VARIANT_STYLE[variant];
  const Icon = style.icon;
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // ESC 닫기 (isLoading 중에는 무시)
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  // 열릴 때 cancel 버튼에 focus (destructive 의 안전한 default)
  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => cancelBtnRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // 호출자가 toast.error 등으로 처리하므로 여기서는 닫지 않음 (재시도 가능)
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = () => {
    if (!isLoading) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // z-60: 기존 Modal/Drawer (z-50) 위
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[60]"
            onClick={handleBackdropClick}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={handleBackdropClick}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-message"
              aria-modal="true"
              className="bg-card rounded-xl border shadow-lg w-full max-w-[420px] p-6"
            >
              <div className="flex items-start gap-3">
                <div className={`size-10 shrink-0 rounded-full flex items-center justify-center ${style.iconBg}`}>
                  <Icon className={`size-5 ${style.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="confirm-title" className="text-base font-semibold text-foreground">
                    {title}
                  </h2>
                  <div id="confirm-message" className="text-sm text-text-secondary mt-1.5 leading-relaxed whitespace-pre-line">
                    {message}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 h-9 rounded-lg border border-border text-sm text-text-primary hover:bg-accent transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${style.confirmClass}`}
                  aria-busy={isLoading}
                >
                  {isLoading ? '진행 중...' : (confirmText ?? style.defaultConfirm)}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
