import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackSelect } from '@/lib/data';
import { fail, limited } from '@/lib/server';
import { canonicalUrl, resolveTrack, ScError } from '@/lib/soundcloud';

// Предпросмотр трека по ссылке (в базу ничего не пишет).
export async function GET(req: Request) {
  if (limited(req, 'resolve', 90, 60_000)) return fail(429, 'Слишком много запросов, подождите минуту');
  const raw = new URL(req.url).searchParams.get('url') ?? '';
  if (!raw || raw.length > 500) return fail(400, 'Вставьте ссылку на трек SoundCloud');
  try {
    const url = await canonicalUrl(raw);
    const existing = await db.track.findFirst({ where: { soundcloudUrl: url }, select: trackSelect });
    if (existing) return NextResponse.json({ ...existing, inLibrary: true });
    const { soundcloudId: _, ...t } = await resolveTrack(url);
    return NextResponse.json({ ...t, inLibrary: false });
  } catch (e) {
    if (!(e instanceof ScError)) console.error('resolve failed', e);
    return fail(422, e instanceof ScError ? e.message : 'Не удалось проверить ссылку');
  }
}
