import { db } from './db';
import { canonicalUrl, resolveTrack, ScError, type ScTrack } from './soundcloud';
import { norm } from './text';

// Публичные поля трека. soundcloudId сюда не входит: по нему можно было бы вычислить ответ раунда.
export const trackSelect = {
  id: true,
  title: true,
  artist: true,
  artworkUrl: true,
  soundcloudUrl: true,
  durationMs: true,
  playable: true,
  createdAt: true,
} as const;

export type PublicTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  soundcloudUrl: string;
  durationMs: number | null;
  playable: boolean;
  createdAt: string | Date;
};

export type PlaylistCard = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  count: number;
  covers: (string | null)[];
};

export async function listPlaylists(take?: number): Promise<PlaylistCard[]> {
  const rows = await db.playlist.findMany({
    where: { tracks: { some: {} } }, // альбом артиста дня, пока он собирается, ещё пустой
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      avatarUrl: true,
      _count: { select: { tracks: true } },
      tracks: { orderBy: { position: 'asc' }, take: 4, select: { track: { select: { artworkUrl: true } } } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
    count: p._count.tracks,
    covers: p.avatarUrl ? [p.avatarUrl] : p.tracks.map((t) => t.track.artworkUrl),
  }));
}

export async function getPlaylist(id: string) {
  const p = await db.playlist.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      avatarUrl: true,
      artistDay: true,
      tracks: { orderBy: { position: 'asc' }, select: { track: { select: trackSelect } } },
    },
  });
  return p && { ...p, tracks: p.tracks.map((t) => t.track) };
}

export class InputError extends Error {
  constructor(message: string, public url?: string) {
    super(message);
  }
}

export const MAX_TRACKS = 100;

export function parsePlaylistInput(body: unknown) {
  const b = (body ?? {}) as { title?: unknown; description?: unknown; urls?: unknown };
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (!title || title.length > 80) throw new InputError('Название обязательно (до 80 символов)');
  if (description.length > 300) throw new InputError('Описание — до 300 символов');
  if (!Array.isArray(b.urls) || !b.urls.length || !b.urls.every((u) => typeof u === 'string' && u.length < 500))
    throw new InputError('Добавьте хотя бы один трек');
  if (b.urls.length > MAX_TRACKS) throw new InputError(`Не больше ${MAX_TRACKS} треков в плейлисте`);
  return { title, description: description || null, urls: b.urls as string[] };
}

// Ссылки -> id треков общей библиотеки (в порядке добавления, без дублей).
// Трек, который уже есть в базе, переиспользуется; новый создаётся один раз.
export async function ensureTracks(urls: string[]): Promise<string[]> {
  const resolved: ({ id: string } | ScTrack)[] = [];
  for (let i = 0; i < urls.length; i += 6) {
    const chunk = urls.slice(i, i + 6).map(async (raw) => {
      try {
        const url = await canonicalUrl(raw);
        return (await db.track.findFirst({ where: { soundcloudUrl: url }, select: { id: true } })) ?? (await resolveTrack(url));
      } catch (e) {
        throw new InputError(e instanceof ScError ? e.message : 'Не удалось проверить ссылку', raw);
      }
    });
    resolved.push(...(await Promise.all(chunk)));
  }
  const ids: string[] = [];
  for (const t of resolved) {
    const id =
      'id' in t
        ? t.id
        : (
            await db.track.upsert({
              where: { soundcloudId: t.soundcloudId },
              update: {},
              create: { ...t, search: norm(`${t.title} ${t.artist}`) },
              select: { id: true },
            })
          ).id;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
