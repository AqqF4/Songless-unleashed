import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlaylist } from '@/lib/data';
import { Collage, TrackRow } from '@/components/ui';
import { fmtDate, songs } from '@/lib/format';
import ManageBox from './ManageBox';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: (await getPlaylist((await params).id))?.title ?? 'Плейлист' };
}

export default async function Category({ params, searchParams }: Props) {
  const p = await getPlaylist((await params).id);
  if (!p) notFound();
  const { created, saved } = await searchParams;
  const playable = p.tracks.filter((t) => t.playable).length;
  return (
    <div className="flex flex-col gap-6">
      {(created || saved) && (
        <p role="status" className="animate-pop glass !rounded-2xl border-neon/40 p-4 text-sm font-semibold text-neon">
          {created ? 'Плейлист создан и опубликован на главной ✓' : 'Изменения сохранены ✓'}
        </p>
      )}
      <ManageBox id={p.id} justCreated={!!created} />
      <header className="glass flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="w-32 shrink-0 sm:w-40">
          <Collage covers={p.avatarUrl ? [p.avatarUrl] : p.tracks.slice(0, 4).map((t) => t.artworkUrl)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.25em] text-neon uppercase">Категория</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight break-words">{p.title}</h1>
          {p.description && <p className="muted mt-2 text-sm">{p.description}</p>}
          <p className="muted mt-2 text-sm">
            {songs(p.tracks.length)} · опубликован {fmtDate(p.createdAt)}
          </p>
          {playable > 0 && playable < 5 && (
            <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-2 text-sm text-amber-200">
              В категории мало треков ({playable}) — песни в игре будут быстро повторяться.
            </p>
          )}
          {playable ? (
            <Link href={`/play?playlist=${p.id}`} className="btn btn-neon mt-4">
              ▶ Играть
            </Link>
          ) : (
            <p className="mt-3 text-sm text-red-300">Нет доступных для воспроизведения треков — играть нельзя.</p>
          )}
        </div>
      </header>
      <div className="grid gap-2 md:grid-cols-2">
        {p.tracks.map((t) => (
          <TrackRow key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
