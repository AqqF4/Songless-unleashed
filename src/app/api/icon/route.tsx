import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Динамическая иконка: коллаж обложек пяти последних треков (2 сверху + 3 снизу). Нет обложек — фирменная заглушка.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const size = Math.min(512, Math.max(16, Number(sp.get('size')) || 64));
  // brand — только фирменный знак, без обложек (для системной панели медиа во время раунда)
  const tracks = sp.has('brand') ? [] : await db.track.findMany({
    where: { artworkUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { artworkUrl: true },
  });
  // Картинки качаем сами: недоступная обложка просто выпадает из коллажа, а не ломает иконку.
  const small = size <= 128 ? 't120x120' : 't500x500';
  const covers = (
    await Promise.all(
      tracks.map(async (t) => {
        try {
          const r = await fetch(t.artworkUrl!.replace('t500x500', small));
          if (!r.ok) return null;
          return `data:${r.headers.get('content-type') ?? 'image/jpeg'};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
        } catch {
          return null;
        }
      }),
    )
  ).filter((c): c is string => !!c);

  const rows = covers.length > 3 ? [covers.slice(0, 2), covers.slice(2)] : covers.length ? [covers] : [];
  const bar = (h: number) => (
    <div style={{ width: size * 0.13, height: size * h, borderRadius: size, background: '#39ff88', margin: size * 0.035 }} />
  );
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          borderRadius: size * 0.2,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #062414, #020805)',
        }}
      >
        {rows.length ? (
          rows.map((row, i) => (
            <div key={i} style={{ display: 'flex' }}>
              {row.map((src, j) => (
                <img key={j} src={src} width={size / row.length} height={size / rows.length} style={{ objectFit: 'cover' }} />
              ))}
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {bar(0.3)}
            {bar(0.6)}
            {bar(0.42)}
          </div>
        )}
      </div>
    ),
    { width: size, height: size, headers: { 'cache-control': 'public, max-age=60' } },
  );
}
