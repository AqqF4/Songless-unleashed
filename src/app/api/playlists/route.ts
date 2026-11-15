import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTracks, InputError, listPlaylists, parsePlaylistInput } from '@/lib/data';
import { fail, hashToken, limited, newToken } from '@/lib/server';

export async function GET() {
  return NextResponse.json(await listPlaylists());
}

export async function POST(req: Request) {
  if (limited(req, 'create', 5, 10 * 60_000)) return fail(429, 'Слишком много плейлистов за короткое время, попробуйте позже');
  try {
    const input = parsePlaylistInput(await req.json().catch(() => null));
    const ids = await ensureTracks(input.urls);
    const token = newToken();
    const p = await db.playlist.create({
      data: {
        title: input.title,
        description: input.description,
        tokenHash: hashToken(token),
        tracks: { create: ids.map((trackId, position) => ({ trackId, position })) },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: p.id, token }, { status: 201 });
  } catch (e) {
    if (e instanceof InputError) return fail(422, e.message, { url: e.url });
    throw e;
  }
}
