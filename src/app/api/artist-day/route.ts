import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTracks } from '@/lib/data';
import { fail, hashToken, limited, newToken } from '@/lib/server';
import { canonicalUrl, resolveArtist } from '@/lib/soundcloud';

export const dynamic = 'force-dynamic';

const ALBUM_SIZE = 10;
const MIN_TRACKS = 3;
const today = () => new Date().toISOString().slice(0, 10);
const slugOf = (url: string) => new URL(url).pathname.split('/')[1];
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

const select = { id: true, title: true, avatarUrl: true, artistSlug: true, artistDay: true, _count: { select: { tracks: true } } };

// Артист дня. Артист выбирается один раз на дату (UTC) и закрепляется в базе пустым альбомом.
// Список треков артиста без ключей API даёт только Widget API в браузере, поэтому треки
// присылает первый посетитель дня (POST), а сервер перепроверяет каждый через oEmbed.
export async function GET() {
  const date = today();
  const existing = await db.playlist.findUnique({ where: { artistDay: date }, select });
  if (existing) return NextResponse.json(existing);

  // shortcut: кандидаты — загрузчики треков из общей библиотеки; поиск по всему SoundCloud требует ключей API
  const urls = await db.track.findMany({ where: { playable: true }, select: { soundcloudUrl: true } });
  const recent = await db.playlist.findMany({
    where: { artistDay: { not: null } },
    orderBy: { artistDay: 'desc' },
    take: 14,
    select: { artistSlug: true },
  });
  const all = [...new Set(urls.map((u) => slugOf(u.soundcloudUrl)))];
  const used = new Set(recent.map((r) => r.artistSlug));
  const candidates = shuffle(all.filter((s) => !used.has(s))).concat(shuffle(all.filter((s) => used.has(s))));
  if (!candidates.length) return fail(404, 'В библиотеке пока нет артистов');

  for (const slug of candidates.slice(0, 5)) {
    const artist = await resolveArtist(slug).catch(() => null);
    if (!artist) continue;
    const created = await db.playlist
      .create({
        data: {
          title: artist.name,
          description: `Артист дня · ${date}`,
          avatarUrl: artist.avatarUrl,
          artistSlug: slug,
          artistDay: date,
          tokenHash: hashToken(newToken()), // токен никому не выдаётся: альбом не редактируется
        },
        select,
      })
      .catch(() => db.playlist.findUnique({ where: { artistDay: date }, select })); // гонка первых запросов дня
    return NextResponse.json(created);
  }
  return fail(503, 'SoundCloud не отвечает, попробуйте позже');
}

// Наполнение сегодняшнего альбома. Принимаются только треки этого артиста, каждый проверяется на сервере.
export async function POST(req: Request) {
  if (limited(req, 'artist-day', 5, 60_000)) return fail(429, 'Слишком много запросов');
  const date = today();
  const album = await db.playlist.findUnique({ where: { artistDay: date }, select });
  if (!album?.artistSlug) return fail(404, 'Артист дня ещё не выбран');
  if (album._count.tracks) return NextResponse.json(album);

  const body = (await req.json().catch(() => ({}))) as { urls?: unknown };
  const raw = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string' && u.length < 500).slice(0, 200) : [];
  const own: string[] = [];
  for (const u of raw) {
    const url = await canonicalUrl(u).catch(() => null);
    if (url && slugOf(url) === album.artistSlug.toLowerCase() && !own.includes(url)) own.push(url);
  }

  const ids: string[] = [];
  for (const url of shuffle(own)) {
    if (ids.length >= ALBUM_SIZE) break;
    const [id] = await ensureTracks([url]).catch(() => []); // недоступный трек просто пропускаем
    if (id && !ids.includes(id)) ids.push(id);
  }

  if (ids.length < MIN_TRACKS) {
    // у артиста мало доступных треков — освобождаем день, следующий GET выберет другого
    await db.playlist.deleteMany({ where: { id: album.id, tracks: { none: {} } } });
    return fail(422, 'У этого артиста мало доступных треков, выбираем другого', { retry: true });
  }
  const filled = await db.$transaction(async (tx) => {
    const fresh = await tx.playlist.findUnique({ where: { id: album.id }, select });
    if (fresh?._count.tracks) return fresh; // другой посетитель успел раньше
    await tx.playlistTrack.createMany({ data: ids.map((trackId, position) => ({ playlistId: album.id, trackId, position })) });
    return tx.playlist.findUnique({ where: { id: album.id }, select });
  });
  return NextResponse.json(filled);
}
