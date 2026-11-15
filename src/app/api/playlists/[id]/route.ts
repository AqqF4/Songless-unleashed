import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTracks, getPlaylist, InputError, parsePlaylistInput } from '@/lib/data';
import { fail, hashToken, limited } from '@/lib/server';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const p = await getPlaylist((await params).id);
  return p ? NextResponse.json(p) : fail(404, 'Плейлист не найден');
}

async function authorize(req: Request, id: string) {
  if (limited(req, 'manage', 30, 60_000)) return fail(429, 'Слишком много запросов');
  const p = await db.playlist.findUnique({ where: { id }, select: { tokenHash: true } });
  if (!p) return fail(404, 'Плейлист не найден');
  const token = req.headers.get('x-manage-token') ?? '';
  if (!token || hashToken(token) !== p.tokenHash) return fail(403, 'Неверная ссылка управления');
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await authorize(req, id);
  if (denied) return denied;
  try {
    const input = parsePlaylistInput(await req.json().catch(() => null));
    const ids = await ensureTracks(input.urls);
    await db.$transaction([
      db.playlistTrack.deleteMany({ where: { playlistId: id } }),
      db.playlist.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          tracks: { create: ids.map((trackId, position) => ({ trackId, position })) },
        },
      }),
    ]);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof InputError) return fail(422, e.message, { url: e.url });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await authorize(req, id);
  if (denied) return denied;
  await db.playlist.delete({ where: { id } }); // треки остаются в общей библиотеке
  return NextResponse.json({ ok: true });
}
