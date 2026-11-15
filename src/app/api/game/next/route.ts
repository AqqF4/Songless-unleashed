import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail } from '@/lib/server';
import { isAvailable } from '@/lib/soundcloud';

// Следующий трек сессии. exclude — уже сыгранные; когда пул исчерпан — { done: true }.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { playlistIds?: unknown; exclude?: unknown };
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5000) : []);
  const playlistIds = strings(body.playlistIds);
  const exclude = strings(body.exclude);

  // shortcut: случайный выбор в памяти по списку id, ок для десятков тысяч треков; дальше — выбор по случайному смещению в SQL
  let pool = await db.track.findMany({
    where: { playable: true, ...(playlistIds.length ? { playlists: { some: { playlistId: { in: playlistIds } } } } : {}) },
    select: { id: true, soundcloudId: true, soundcloudUrl: true },
  });
  for (let tries = 0; tries < 5 && pool.length; tries++) {
    const fresh = pool.filter((t) => !exclude.includes(t.id));
    // все треки источника сыграны — сессия окончена, клиент показывает итоги
    if (!fresh.length) return NextResponse.json({ done: true });
    const pick = fresh[Math.floor(Math.random() * fresh.length)];
    if ((await isAvailable(pick.soundcloudUrl)) === false) {
      // трек удалили или закрыли на SoundCloud — убираем из игры и берём другой
      await db.track.update({ where: { id: pick.id }, data: { playable: false, metaStatus: 'unavailable' } });
      pool = pool.filter((t) => t.id !== pick.id);
      continue;
    }
    return NextResponse.json({ id: pick.id, soundcloudId: pick.soundcloudId, poolSize: pool.length, left: fresh.length - 1 });
  }
  return fail(404, 'Нет доступных для игры треков');
}
