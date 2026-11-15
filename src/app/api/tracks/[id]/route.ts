import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackSelect } from '@/lib/data';
import { fail, limited } from '@/lib/server';
import { isAvailable } from '@/lib/soundcloud';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const t = await db.track.findUnique({ where: { id: (await params).id }, select: trackSelect });
  return t ? NextResponse.json(t) : fail(404, 'Трек не найден');
}

// Жалоба на трек. Заодно перепроверяем его в SoundCloud: удалённые треки выводятся из игры.
export async function POST(req: Request, { params }: Ctx) {
  if (limited(req, 'report', 20, 60_000)) return fail(429, 'Слишком много запросов');
  const t = await db.track.findUnique({ where: { id: (await params).id } });
  if (!t) return fail(404, 'Трек не найден');
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : 'unspecified';
  await db.report.create({ data: { trackId: t.id, reason } });
  const ok = await isAvailable(t.soundcloudUrl);
  if (ok === false) await db.track.update({ where: { id: t.id }, data: { playable: false, metaStatus: 'unavailable' } });
  return NextResponse.json({ ok: true, playable: ok !== false });
}
