import ExcelJS from 'exceljs';

// ═══════════════════════════════════════
// 서버사이드: 엑셀 워크북 생성
// ═══════════════════════════════════════

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
  style?: Partial<ExcelJS.Style>;
}

export async function createExcelBuffer(config: {
  sheetName: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pocolush CRM';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(config.sheetName);

  // 컬럼 정의
  sheet.columns = config.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
    style: col.style,
  }));

  // 헤더 스타일
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 24;

  // 데이터 행 추가
  config.rows.forEach((row) => {
    sheet.addRow(row);
  });

  // 자동 필터
  if (config.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: config.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ═══════════════════════════════════════
// 엑셀 응답 생성 (API Route용)
// ═══════════════════════════════════════

export function createExcelResponse(buffer: Buffer, filename: string): Response {
  const encodedFilename = encodeURIComponent(`${filename}.xlsx`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ═══════════════════════════════════════
// 클라이언트: 엑셀 다운로드 트리거
// ═══════════════════════════════════════

export async function downloadExcel(
  target: string,
  params?: Record<string, string>,
): Promise<void> {
  const searchParams = new URLSearchParams();
  searchParams.set('target', target);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.set(k, v);
    });
  }

  const response = await fetch(`/api/export?${searchParams.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '다운로드 실패');
  }

  // 반드시 .blob() 사용 — .text() 쓰면 바이너리 손상
  const blob = await response.blob();

  // Content-Disposition에서 파일명 추출
  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)/);
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1])
    : `${target}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
