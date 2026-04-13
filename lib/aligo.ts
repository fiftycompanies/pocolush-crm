// 알리고 알림톡 API 클라이언트 (비활성화 상태)

interface AligoConfig {
  apiKey: string;
  userId: string;
  sender: string;
  senderKey: string;
}

interface SendResult {
  success: boolean;
  message: string;
  response?: unknown;
}

function getConfig(): AligoConfig | null {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;
  const senderKey = process.env.ALIGO_SENDER_KEY;

  if (!apiKey || !userId || !sender || !senderKey) return null;
  return { apiKey, userId, sender, senderKey };
}

export async function sendAlimtalk(
  phone: string,
  templateCode: string,
  message: string
): Promise<SendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, message: 'ALIGO_NOT_CONFIGURED' };
  }

  try {
    const formData = new FormData();
    formData.append('apikey', config.apiKey);
    formData.append('userid', config.userId);
    formData.append('senderkey', config.senderKey);
    formData.append('tpl_code', templateCode);
    formData.append('sender', config.sender);
    formData.append('receiver_1', phone.replace(/-/g, ''));
    formData.append('subject_1', templateCode);
    formData.append('message_1', message);

    const res = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return {
      success: data.code === 0,
      message: data.message || 'OK',
      response: data,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}
