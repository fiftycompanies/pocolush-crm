import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'POCOLUSH CRM — 포코러쉬 문의 관리',
  description: '포코러쉬 내부 문의 관리 대시보드',
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
