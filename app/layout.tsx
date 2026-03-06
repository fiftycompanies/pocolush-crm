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
              color: '#111827',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
            },
            success: {
              style: {
                borderLeft: '4px solid #16A34A',
              },
            },
            error: {
              style: {
                borderLeft: '4px solid #EF4444',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
