/**
 * Axiom 로그 수집 (@axiomhq/js)
 * - Free 500MB/mo
 * - env: AXIOM_TOKEN, AXIOM_DATASET
 * - 실패 swallow, 토큰 없으면 console.log fallback
 */

import { Axiom } from '@axiomhq/js';

let clientInstance: Axiom | null = null;
let warned = false;

function getClient(): Axiom | null {
  if (clientInstance) return clientInstance;
  const token = process.env.AXIOM_TOKEN;
  if (!token) {
    if (!warned) {
      console.warn('[axiom] AXIOM_TOKEN 미설정 — console fallback');
      warned = true;
    }
    return null;
  }
  clientInstance = new Axiom({ token });
  return clientInstance;
}

export interface AxiomEvent {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  [key: string]: unknown;
}

/**
 * 이벤트 1건 ingestion (비동기 fire-and-forget).
 * - dataset: AXIOM_DATASET env (default 'pocolush-logs')
 * - 실패 swallow
 */
export function axiomLog(event: AxiomEvent): void {
  const client = getClient();
  const dataset = process.env.AXIOM_DATASET || 'pocolush-logs';
  const enriched = {
    ...event,
    _time: new Date().toISOString(),
    _env: process.env.VERCEL_ENV ?? 'local',
    _region: process.env.VERCEL_REGION ?? 'unknown',
  };

  if (!client) {
    // fallback — console
    console.log(`[axiom:${event.level}]`, event.event, enriched);
    return;
  }

  try {
    client.ingest(dataset, [enriched]);
    // flush 는 fire-and-forget — await 없음 (Edge/Serverless 환경 이탈 시 lost 가능)
    // 중요 이벤트는 flush() 호출 필요
    void client.flush().catch(e => console.error('[axiom] flush 실패:', e));
  } catch (e) {
    console.error('[axiom] ingest 실패:', e);
  }
}
