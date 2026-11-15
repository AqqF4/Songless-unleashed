'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PlaylistCard, PublicTrack } from '@/lib/data';

import { fmtDate, songs } from '@/lib/format';

// Обложка. Если картинка не загрузилась — заглушка с пометкой, а не пустая дыра.
export function Cover({ src, className = '', small }: { src: string | null; className?: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-emerald-900/60 to-black text-neon/70 ${className}`}
        title={failed ? 'Не удалось загрузить обложку' : 'Нет обложки'}
        role="img"
        aria-label={failed ? 'Не удалось загрузить обложку' : 'Нет обложки'}
      >
        {failed ? '!' : '♪'}
      </div>
    );
  return (
    <img
      src={small && src.includes('/artworks-') ? src.replace('t500x500', 't200x200') : src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function Collage({ covers }: { covers: (string | null)[] }) {
  const list = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  return (
    <div className={`grid aspect-square overflow-hidden rounded-2xl ${list.length === 4 ? 'grid-cols-2' : ''}`}>
      {list.length ? list.map((c, i) => <Cover key={i} src={c} small className="h-full w-full" />) : <Cover src={null} className="h-full w-full" />}
    </div>
  );
}

export function PlaylistTile({ p }: { p: PlaylistCard }) {
  return (
    <article className="glass group flex flex-col gap-3 p-3 transition duration-300 hover:-translate-y-1 hover:border-neon/30">
      <Link href={`/categories/${p.id}`} className="block">
        <Collage covers={p.covers} />
        <h3 className="mt-3 truncate font-bold">{p.title}</h3>
        <p className="muted text-xs">
          {songs(p.count)} · {fmtDate(p.createdAt)}
        </p>
      </Link>
      <Link href={`/play?playlist=${p.id}`} className="btn btn-neon mt-auto !min-h-10">
        ▶ Играть
      </Link>
    </article>
  );
}

export function TrackRow({ t, children }: { t: PublicTrack; children?: React.ReactNode }) {
  return (
    <div className="glass flex items-center gap-3 !rounded-2xl p-2 pr-3">
      <Cover src={t.artworkUrl} small className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{t.title}</div>
        <div className="muted truncate text-sm">{t.artist}</div>
      </div>
      {!t.playable && <span className="rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300">недоступен</span>}
      {children}
      <a
        href={t.soundcloudUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-neon hover:underline"
      >
        SoundCloud ↗
      </a>
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="glass mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <div className="text-3xl text-neon">♪</div>
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="muted text-sm">{text}</p>}
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="muted flex items-center justify-center gap-3 p-10 text-sm" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon/30 border-t-neon" />
      {label}
    </div>
  );
}

// Время до следующих 00:00 UTC (смена Daily и Артиста дня).
export function Countdown() {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date().setUTCHours(24, 0, 0, 0) - Date.now()) / 1000));
      setLeft([s / 3600, (s / 60) % 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':'));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{left}</span>;
}

// Поделиться: системное меню на мобильных, иначе буфер обмена.
export function ShareButton({ text, className = 'btn' }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } catch {}
  };
  return (
    <button className={className} onClick={share}>
      {done ? 'Скопировано ✓' : 'Поделиться результатом'}
    </button>
  );
}
