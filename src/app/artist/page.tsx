'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Countdown, Cover, Empty, Spinner } from '@/components/ui';
import { songs } from '@/lib/format';
import { api, post } from '@/lib/local';
import { loadScApi } from '@/components/useScPlayer';

type Album = { id: string; title: string; avatarUrl: string | null; artistSlug: string; artistDay: string; _count: { tracks: number } };
type Sound = { title?: string; permalink_url?: string; streamable?: boolean; policy?: string };

// Список треков артиста через официальный Widget API (getSounds у виджета профиля).
async function artistTrackUrls(slug: string): Promise<string[]> {
  await loadScApi();
  const f = document.createElement('iframe');
  f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${slug}`)}&auto_play=false`;
  f.className = 'pointer-events-none fixed h-px w-px opacity-0';
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  document.body.append(f);
  try {
    const w = window.SC!.Widget(f);
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('Виджет SoundCloud не загрузился')), 15000);
      w.bind(window.SC!.Widget.Events.READY, () => (clearTimeout(t), res()));
    });
    let sounds: Sound[] = [];
    // виджет догружает подробности треков не сразу
    for (let i = 0; i < 8; i++) {
      sounds = await new Promise((r) => w.getSounds(r));
      if (sounds.length && sounds.every((s) => s.permalink_url)) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    const ok = sounds.filter((s) => s.permalink_url && s.streamable !== false && s.policy !== 'BLOCK');
    // SNIP — только 30-секундное превью (Go+), берём его лишь если полных треков мало
    const full = ok.filter((s) => s.policy !== 'SNIP');
    return (full.length >= 3 ? full : ok).map((s) => s.permalink_url!);
  } finally {
    f.remove();
  }
}

export default function ArtistOfTheDay() {
  const [album, setAlbum] = useState<Album | null>(null);
  const [status, setStatus] = useState<'loading' | 'building' | 'ready'>('loading');
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      for (let attempt = 0; attempt < 3 && !dead; attempt++) {
        let a = await api<Album>('/api/artist-day');
        if (!a._count.tracks) {
          // альбом на сегодня ещё не собран — собираем его из треков артиста
          setStatus('building');
          setAlbum(a);
          try {
            a = await api<Album>('/api/artist-day', post({ urls: await artistTrackUrls(a.artistSlug) }));
          } catch (e) {
            if ((e as { data?: { retry?: boolean } }).data?.retry) continue; // сервер освободил день — следующий артист
            throw e;
          }
        }
        if (!dead) (setAlbum(a), setStatus('ready'));
        return;
      }
      throw new Error('Не удалось собрать альбом артиста дня. Попробуйте позже.');
    })().catch((e) => !dead && setError(e));
    return () => {
      dead = true;
    };
  }, []);

  if (error)
    return error.status === 404 ? (
      <Empty title="Артиста дня пока нет" text="Артист выбирается среди авторов треков общей библиотеки. Добавьте первый плейлист.">
        <Link href="/create" className="btn btn-neon">
          Создать плейлист
        </Link>
      </Empty>
    ) : (
      <Empty title="Не удалось загрузить артиста дня" text={error.message}>
        <button className="btn" onClick={() => location.reload()}>
          Повторить
        </button>
      </Empty>
    );
  if (status === 'loading' || !album) return <Spinner label="Выбираю артиста дня…" />;

  return (
    <div className="glass animate-pop relative mx-auto flex max-w-xl flex-col items-center gap-5 overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-neon/20 blur-3xl" />
      <p className="relative text-xs font-bold tracking-[0.3em] text-neon uppercase">Артист дня</p>
      <Cover src={album.avatarUrl} className="relative h-44 w-44 rounded-full border-2 border-neon/50 text-5xl shadow-[0_0_60px_-10px_rgb(57_255_136/0.7)]" />
      <div className="relative">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{album.title}</h1>
        <p className="muted mt-1 text-sm">
          {status === 'building' ? 'Собираю альбом из треков SoundCloud…' : `${songs(album._count.tracks)} · угадайте их все`}
        </p>
      </div>
      {status === 'building' ? (
        <Spinner />
      ) : (
        <div className="relative flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/play?playlist=${album.id}`} className="btn btn-neon !min-h-13 !px-8">
            ▶ Играть
          </Link>
          <Link href={`/categories/${album.id}`} className="btn !min-h-13">
            Альбом
          </Link>
        </div>
      )}
      <p className="muted relative text-xs">
        Новый артист через <Countdown /> · 00:00 UTC
      </p>
    </div>
  );
}
