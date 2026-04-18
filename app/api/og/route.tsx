import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = (searchParams.get('title') ?? 'POCOLUSH 자람터').slice(0, 60);
    const subtitle = (searchParams.get('subtitle') ?? '자연 속 프리미엄 힐링 공간').slice(0, 80);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '80px',
            background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.9, marginBottom: 24, display: 'flex' }}>
            🌱 POCOLUSH
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 1.2,
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              opacity: 0.92,
              textAlign: 'center',
              display: 'flex',
            }}
          >
            {subtitle}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error('[og] generation failed', err);
    return new Response('OG generation failed', { status: 500 });
  }
}
