import Link from 'next/link';
import { db } from '@/lib/db';
import { listPlaylists, trackSelect } from '@/lib/data';
import { Empty, PlaylistTile, TrackRow } from '@/components/ui';

export default async function Home() {
  const [playlists, tracks] = await Promise.all([
    listPlaylists(12),
    db.track.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: trackSelect }),
  ]);
  return (
    <div className="flex flex-col gap-12">
      <section className="glass relative overflow-hidden px-6 py-12 text-center sm:py-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-neon/20 blur-3xl" />
        <p className="relative mb-3 text-xs font-bold tracking-[0.3em] text-neon uppercase">Музыкальная игра на SoundCloud</p>
        <h1 className="relative mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          Угадай трек по <span className="text-neon drop-shadow-[0_0_18px_rgb(57_255_136/0.6)]">первой секунде</span>
        </h1>
        <p className="muted relative mx-auto mt-4 max-w-xl text-balance">
          Короткий фрагмент — и шесть попыток. Чем раньше узнаешь песню, тем больше очков. Все треки добавляют сами игроки.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/daily" className="btn btn-neon !min-h-13 !px-8 !text-base">
            Daily Challenge
          </Link>
          <Link href="/play" className="btn !min-h-13 !px-8 !text-base">
            Unlimited ∞
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="h-section !mb-0">Недавно созданные плейлисты</h2>
          <Link href="/categories" className="text-sm font-semibold text-neon hover:underline">
            Все →
          </Link>
        </div>
        {playlists.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {playlists.map((p) => (
              <PlaylistTile key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Empty title="Плейлистов пока нет" text="Создайте первый: вставьте ссылки на треки SoundCloud, и он сразу появится здесь.">
            <Link href="/create" className="btn btn-neon">
              Создать плейлист
            </Link>
          </Empty>
        )}
      </section>

      {tracks.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="h-section !mb-0">Последние добавленные треки</h2>
            <Link href="/songs" className="text-sm font-semibold text-neon hover:underline">
              Все →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {tracks.map((t) => (
              <TrackRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
