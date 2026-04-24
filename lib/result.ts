/**
 * Result<T, E> 타입 — 에러를 반환값으로 강제 (throw 대신)
 * (v3 §10 M-5, research #07 권고)
 *
 * 사용 예:
 *   async function upload(): Promise<Result<Photo, UploadError>> { ... }
 *   const result = await upload();
 *   if (!result.ok) { toast.error(result.error.message); return; }
 *   console.log(result.value);
 */

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}

export const ok = <T,>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E = AppError>(error: E): Result<never, E> => ({ ok: false, error });

/** 기본 앱 에러 생성 유틸 */
export const appError = (code: string, message: string, cause?: unknown): AppError => ({
  code,
  message,
  cause,
});

/**
 * Result<T,E> 를 Promise 로 평탄화
 * - 에러 시 throw 하지 않고 error 객체 반환
 */
export async function tryResult<T>(
  promise: Promise<T>,
  onError: (e: unknown) => AppError = (e) => appError('unknown', String(e), e),
): Promise<Result<T>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(onError(e));
  }
}

/**
 * Supabase 쿼리 결과를 Result 로 변환
 * - { data, error } 중 하나를 반환하는 PostgREST 패턴
 */
export function fromSupabase<T>(res: { data: T | null; error: { message: string } | null }): Result<T> {
  if (res.error) return err(appError('supabase', res.error.message, res.error));
  if (res.data === null) return err(appError('not_found', 'No data returned'));
  return ok(res.data);
}
