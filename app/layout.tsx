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
              background: '#1A2E1E',
              color: '#F0EDE6',
              border: '1px solid #2A3D2E',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  );
}
