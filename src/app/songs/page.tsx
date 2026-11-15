'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Empty, Spinner, TrackRow } from '@/components/ui';
import { songs } from '@/lib/format';
import type { PublicTrack } from '@/lib/data';
import { api } from '@/lib/local';

type Page = { items: PublicTrack[]; total: number; hasMore: boolean };

export default function Songs() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    const t = setTimeout(
      () =>
        api<Page>(`/api/tracks?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}`)
          .then((d) => {
            if (stale) return;
            setData((old) => (page && old ? { ...d, items: [...old.items, ...d.items] } : d));
            setError('');
          })
          .catch((e) => !stale && setError(e.message))
          .finally(() => !stale && setLoading(false)),
      page ? 0 : 200,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, sort, page]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Песни</h1>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field"
          type="search"
          placeholder="Поиск по названию или исполнителю"
          value={q}
          onChange={(e) => (setQ(e.target.value), setPage(0))}
          aria-label="Поиск песен"
        />
        <select className="field sm:!w-56" value={sort} onChange={(e) => (setSort(e.target.value), setPage(0))} aria-label="Сортировка">
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
        </select>
      </div>

      {error ? (
        <Empty title="Не удалось загрузить песни" text={error}>
          <button className="btn" onClick={() => location.reload()}>
            Повторить
          </button>
        </Empty>
      ) : !data ? (
        <Spinner label="Загрузка каталога…" />
      ) : !data.total && !q ? (
        <Empty title="Библиотека пуста" text="Здесь появятся все треки из всех плейлистов. Создайте первый плейлист.">
          <Link href="/create" className="btn btn-neon">
            Создать плейлист
          </Link>
        </Empty>
      ) : !data.total ? (
        <Empty title="Ничего не найдено" text={`По запросу «${q}» в общей базе нет треков.`} />
      ) : (
        <>
          <p className="muted text-sm">Найдено: {songs(data.total)}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {data.items.map((t) => (
              <TrackRow key={t.id} t={t} />
            ))}
          </div>
          {data.hasMore && (
            <button className="btn mx-auto" disabled={loading} onClick={() => setPage(page + 1)}>
              {loading ? 'Загрузка…' : 'Показать ещё'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
