import { CheckCircle2 } from 'lucide-react';

const KST_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatKst(iso: string) {
  return KST_FORMATTER.format(new Date(iso)).replace(/\s/g, ' ');
}
import Badge from '@/components/ui/Badge';
import { AckOneButton } from './AckControls';
import type { TriggerErrorLog } from '@/types';

interface Props {
  rows: TriggerErrorLog[];
}

export default function ErrorLogTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-10 text-center">
        <CheckCircle2 className="size-12 text-green mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-text-primary">
          최근 6개월 동안 기록된 오류가 없습니다
        </p>
        <p className="text-[12px] text-text-tertiary mt-1">시스템이 정상 작동 중입니다</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-bg-muted text-text-secondary text-[12px]">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">시각</th>
            <th className="text-left px-4 py-2.5 font-medium">함수</th>
            <th className="text-left px-4 py-2.5 font-medium">코드</th>
            <th className="text-left px-4 py-2.5 font-medium">메시지</th>
            <th className="text-right px-4 py-2.5 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-light hover:bg-bg-muted/30">
              <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                {formatKst(r.created_at)}
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-text-primary">
                {r.function_name}
              </td>
              <td className="px-4 py-3">
                {r.sqlstate && (
                  <Badge label={r.sqlstate} color="#7C3AED" bg="#F5F3FF" />
                )}
              </td>
              <td className="px-4 py-3">
                <details className="cursor-pointer">
                  <summary className="text-text-primary line-clamp-1 max-w-md">
                    {r.message || '(no message)'}
                  </summary>
                  <pre className="mt-2 text-[11px] bg-bg-muted rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(
                      {
                        detail: r.detail,
                        hint: r.hint,
                        context: r.context,
                        exception_context: r.exception_context,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </td>
              <td className="px-4 py-3 text-right">
                {r.acked_at ? (
                  <Badge label="확인됨" color="#059669" bg="#ECFDF5" />
                ) : (
                  <AckOneButton id={r.id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
