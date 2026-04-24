/**
 * 공지 이미지 업로드 훅 — 5-state 머신 + 썸네일 목록 관리
 *
 * 상태:
 * - idle:      초기, 아무 일 없음
 * - dragover:  drop zone 위 드래그 중
 * - uploading: 업로드 진행 중 (카운트/총량 표시)
 * - error:     직전 업로드 실패 (자동 3초 후 idle)
 *
 * 책임:
 * - notice_images 목록 fetch/refresh
 * - 멀티 파일 순차 업로드 (병렬 X — 10장 race 가드 + 사용자 피드백)
 * - 에러 toast, 성공 콜백
 *
 * PR-H3
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  listNoticeImages,
  uploadNoticeImage,
  deleteNoticeImage,
  reorderNoticeImages,
  type UploadedNoticeImage,
} from '@/lib/upload-notice-image';

export type UploadState = 'idle' | 'dragover' | 'uploading' | 'error';

interface Options {
  /** 업로드 성공 1건마다 콜백 — 에디터 커서에 ![](url) 삽입 등 */
  onUploaded?: (image: UploadedNoticeImage) => void;
}

interface UploadProgress {
  current: number;
  total: number;
}

export function useNoticeImageUpload(noticeId: string | null, opts?: Options) {
  const [images, setImages] = useState<UploadedNoticeImage[]>([]);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<UploadProgress>({ current: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const onUploadedRef = useRef(opts?.onUploaded);

  useEffect(() => { onUploadedRef.current = opts?.onUploaded; }, [opts?.onUploaded]);

  // 초기 + noticeId 변경 시 fetch
  const refresh = useCallback(async () => {
    if (!noticeId) { setImages([]); return; }
    setLoading(true);
    const result = await listNoticeImages(noticeId);
    if ('error' in result) {
      toast.error('이미지 목록 불러오기 실패: ' + result.error);
    } else {
      setImages(result.images);
    }
    setLoading(false);
  }, [noticeId]);

  // 마이크로태스크 지연으로 effect 동기 setState 회피 (react-hooks/set-state-in-effect)
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);

  const setDragover = useCallback((on: boolean) => {
    setState((prev) => {
      if (prev === 'uploading') return prev; // 업로드 중에는 상태 유지
      return on ? 'dragover' : 'idle';
    });
  }, []);

  /** 여러 파일 순차 업로드 (10장 race 피해) */
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!noticeId) {
      toast.error('공지 저장 후 이미지를 추가할 수 있습니다 (draft 생성 실패)');
      return;
    }
    if (files.length === 0) return;

    // 현재 장수 + 추가분 > 10 이면 사전 차단
    const remaining = 10 - images.length;
    if (remaining <= 0) {
      toast.error('이미 10장이 업로드되어 추가할 수 없습니다');
      return;
    }
    const batch = files.slice(0, remaining);
    if (files.length > remaining) {
      toast(`최대 ${remaining}장만 업로드됩니다 (10장 제한)`, { icon: '⚠️' });
    }

    setState('uploading');
    setProgress({ current: 0, total: batch.length });

    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      const file = batch[i];
      setProgress({ current: i + 1, total: batch.length });
      const result = await uploadNoticeImage(noticeId, file);
      if ('error' in result) {
        toast.error(result.error);
        // Sentry 훅 (있을 경우) — 조용히 실패 방지
        if (typeof window !== 'undefined' && 'Sentry' in window) {
          try {
            (window as unknown as { Sentry?: { captureException: (e: unknown) => void } })
              .Sentry?.captureException(new Error(`notice image upload: ${result.error}`));
          } catch { /* noop */ }
        }
        continue;
      }
      successCount++;
      setImages((prev) => [...prev, result.image]);
      onUploadedRef.current?.(result.image);
    }

    if (successCount > 0) {
      toast.success(`이미지 ${successCount}장 업로드됨`);
    }

    setState(successCount === batch.length ? 'idle' : 'error');
    setProgress({ current: 0, total: 0 });

    // error 는 3초 후 idle 복귀
    if (successCount !== batch.length) {
      setTimeout(() => setState('idle'), 3000);
    }
  }, [noticeId, images.length]);

  const removeImage = useCallback(async (imageId: string) => {
    const target = images.find((img) => img.id === imageId);
    if (!target) return;
    // 낙관적 제거
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    const result = await deleteNoticeImage(imageId);
    if ('error' in result) {
      toast.error(result.error);
      // 실패 시 재조회로 원복
      refresh();
    } else {
      toast.success('이미지 삭제됨');
    }
  }, [images, refresh]);

  /** 한 칸 좌/우 이동 (WCAG 2.1.1 키보드 지원) */
  const moveImage = useCallback(async (imageId: string, direction: 'left' | 'right') => {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx < 0) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;

    const a = images[idx];
    const b = images[swapIdx];

    // 낙관적 swap
    const next = [...images];
    next[idx] = b;
    next[swapIdx] = a;
    setImages(next);

    const result = await reorderNoticeImages(
      { id: a.id, order: a.display_order },
      { id: b.id, order: b.display_order },
    );
    if ('error' in result) {
      toast.error('순서 변경 실패: ' + result.error);
      refresh();
    }
  }, [images, refresh]);

  return {
    images,
    state,
    progress,
    loading,
    setDragover,
    uploadFiles,
    removeImage,
    moveImage,
    refresh,
  };
}
