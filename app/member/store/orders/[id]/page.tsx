import type { Metadata } from 'next';
import OrderDetailClient from '@/components/member-store/OrderDetailClient';

export const dynamic = 'force-dynamic';

// 개인 주문 상세이므로 OG는 일반화된 메타만 노출 (프라이버시 보호)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await params; // consume
  const title = 'POCOLUSH 서비스 결과물';
  const desc = '신청하신 서비스의 결과물 사진을 확인하세요.';
  const ogUrl = `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent('내 농장 관리 · 결과물 보기')}`;
  return {
    title,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: 'article',
    },
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
