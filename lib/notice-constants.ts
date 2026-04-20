/**
 * 공지/알림 관련 상수
 * - 매직넘버 중앙화 (v3 §10 M-7 Phase 0)
 * - 이 파일만 수정하면 FE/BE 한번에 반영
 */

// 푸시 재발송 rate limit (5분 bucket)
// Phase 3 #1: DB feature_flags 로 이관 예정 (D13)
export const PUSH_RATE_LIMIT_MIN = 5;

// 고정 공지 경고 임계값 (이 이상이면 빨간 배너)
export const PIN_WARNING_THRESHOLD = 10;

// 푸시 메시지 최대 길이 (UTF-8 byte 경계 보호 필요)
// FCM 4KB / 알림톡 1000자 안전선
// Phase 2b #4 sanitize 에서 toPushMessage(md, PUSH_MESSAGE_MAX_BYTES) 로 이관 예정
export const PUSH_MESSAGE_MAX_LEN = 120;
export const PUSH_MESSAGE_MAX_BYTES = 300;
export const ALIMTALK_MESSAGE_MAX_BYTES = 800;
export const OG_DESCRIPTION_MAX_CHARS = 160;

// 공지 본문 최대 길이 (DB CHECK 와 맞춰야 함)
export const NOTICE_TITLE_MAX = 200;
export const NOTICE_CONTENT_MAX = 50000;
