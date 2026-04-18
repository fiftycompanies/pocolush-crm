import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import NoticeDetailClient from '@/components/notices/NoticeDetailClient';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: notice } = await supabase
      .from('notices')
      .select('title, content')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();

    if (!notice) {
      return { title: '공지사항을 찾을 수 없습니다' };
    }

    const desc = (notice.content as string)
      .replace(/[#*`_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    const ogUrl = `/api/og?title=${encodeURIComponent(notice.title as string)}&subtitle=${encodeURIComponent('POCOLUSH 공지사항')}`;

    return {
      title: notice.title as string,
      description: desc,
      openGraph: {
        title: notice.title as string,
        description: desc,
        images: [{ url: ogUrl, width: 1200, height: 630 }],
        type: 'article',
      },
    };
  } catch (err) {
    console.error('[notice/generateMetadata] failed', err);
    return { title: '공지사항' };
  }
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoticeDetailClient id={id} />;
}
