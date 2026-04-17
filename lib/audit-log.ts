// 어드민 감사 로그 헬퍼
// CSV PII 내보내기 등 추적 필요 액션에서 호출

import { createClient } from '@/lib/supabase/client';

export interface AuditLogEntry {
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? null,
      user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (e) {
    // 감사 로그 실패는 핵심 플로우를 막지 않음
    // eslint-disable-next-line no-console
    console.warn('audit_log insert failed', e);
  }
}
