import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Трек дня: выбирается один раз и сохраняется в базе на дату (UTC), поэтому у всех одинаковый.
export async function GET() {
  const date = new Date().toISOString().slice(0, 10);
  const include = { track: { select: { soundcloudId: true } } };
  let d = await db.dailyChallenge.findUnique({ where: { date }, include });
  if (!d) {
    const recent = await db.dailyChallenge.findMany({ orderBy: { date: 'desc' }, take: 30, select: { trackId: true } });
    const all = await db.track.findMany({ where: { playable: true }, select: { id: true } });
    if (!all.length) return fail(404, 'В общей базе пока нет песен');
    // по возможности не повторяем недавние дни
    const used = new Set(recent.slice(0, all.length - 1).map((r) => r.trackId));
    const pool = all.filter((t) => !used.has(t.id));
    const trackId = pool[Math.floor(Math.random() * pool.length)].id;
    d = await db.dailyChallenge
      .create({ data: { date, trackId }, include })
      .catch(() => db.dailyChallenge.findUniqueOrThrow({ where: { date }, include })); // гонка двух первых запросов дня
  }
  return NextResponse.json({ date, id: d.trackId, soundcloudId: d.track.soundcloudId });
}
