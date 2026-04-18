import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
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
