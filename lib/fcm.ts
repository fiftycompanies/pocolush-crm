// FCM 푸시 클라이언트 (비활성화 상태)

interface SendResult {
  success: boolean;
  message: string;
  response?: unknown;
}

export async function sendPush(
  token: string,
  title: string,
  body: string
): Promise<SendResult> {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    return { success: false, message: 'FCM_NOT_CONFIGURED' };
  }

  try {
    // FCM HTTP v1 API
    // 실제 구현 시 firebase-admin SDK 사용 권장
    return {
      success: false,
      message: 'FCM_NOT_IMPLEMENTED',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}
