/**
 * 클라이언트 이미지 유틸
 * - 리사이즈 (max 1600px, JPEG q0.8) — 용량·대역폭 절감
 * - 원본 파일 검증 (타입, 크기)
 *
 * 사용처:
 * - lib/upload-service-photo.ts (향후 이관 예정, 현재는 자체 복제)
 * - lib/upload-notice-image.ts (056 notice_images, PR-H3)
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (056 버킷 한도와 일치)

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

/** MIME + 크기 검증 (Storage 버킷 제약 사전 차단) */
export function validateImageFile(file: File): FileValidationResult {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: `${file.name}: 이미지 파일이 아닙니다` };
  }
  // SVG 차단 (XSS 방지, 056 버킷 정책과 동일)
  if (file.type === 'image/svg+xml') {
    return { ok: false, error: `${file.name}: SVG 는 업로드할 수 없습니다` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, error: `${file.name}: 파일이 너무 큽니다 (${mb}MB / 최대 2MB)` };
  }
  return { ok: true };
}

/** Canvas 기반 리사이즈 — 1600px 이하는 원본 유지, 초과분만 축소 */
export async function resizeImage(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
  bitmap.close();
  return { blob, width, height };
}
