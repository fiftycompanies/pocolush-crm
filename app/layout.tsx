import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

/**
 * metadataBase 우선순위 (H7):
 *  1) NEXT_PUBLIC_APP_URL — 명시 설정 시 최우선
 *  2) VERCEL_URL — Vercel preview/staging (자동 주입, 프로토콜 접두 필요)
 *  3) 'https://app.pocolush.com' — prod 기본값
 * preview/staging 배포에서 OG 태그가 prod 도메인으로 오염되는 문제 해결.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  ?? 'https://app.pocolush.com';

export const metadata: Metadata = {
  // 상대 경로 OG 이미지/URL 을 자동 절대화 (카톡/OG 썸네일 정상화)
  metadataBase: new URL(APP_URL),
  title: {
    default: 'POCOLUSH 자람터',
    template: '%s | POCOLUSH',
  },
  description: '자연 속에서 아이와 함께하는 포코러쉬 자람터',
  openGraph: {
    title: 'POCOLUSH 자람터',
    description: '자연 속에서 아이와 함께하는 포코러쉬 자람터 · 예약 / 회원권 / 공지',
    siteName: 'POCOLUSH',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'POCOLUSH 자람터' }],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '13px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            },
            success: {
              style: {
                borderLeft: '3px solid #16A34A',
              },
            },
            error: {
              style: {
                borderLeft: '3px solid #EF4444',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
