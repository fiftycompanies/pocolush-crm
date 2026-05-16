'use client';

import { ReactNode, useCallback, useRef, useState } from 'react';
import ConfirmDialog, { type ConfirmVariant } from './ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

/**
 * useConfirm() — async/await 패턴으로 ConfirmDialog 호출 (PR-C2)
 *
 * 사용 예:
 * ```tsx
 * const { confirm, dialog } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: '플랜 삭제',
 *     message: `${p.name} 플랜을 삭제합니다.`,
 *     variant: 'destructive',
 *   });
 *   if (!ok) return;
 *   await deletePlan();
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>삭제</button>
 *     {dialog}
 *   </>
 * );
 * ```
 */
export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> => {
      setOptions(opts);
      setIsOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant}
    />
  ) : null;

  return { confirm, dialog };
}
