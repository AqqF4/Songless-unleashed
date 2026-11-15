'use client';
import { useState } from 'react';
import { Empty, PlaylistTile } from '@/components/ui';
import type { PlaylistCard } from '@/lib/data';
import { norm } from '@/lib/text';

const SORTS: Record<string, (a: PlaylistCard, b: PlaylistCard) => number> = {
  new: (a, b) => b.createdAt.localeCompare(a.createdAt),
  old: (a, b) => a.createdAt.localeCompare(b.createdAt),
  big: (a, b) => b.count - a.count,
  az: (a, b) => a.title.localeCompare(b.title, 'ru'),
};

export default function CategoryGrid({ playlists }: { playlists: PlaylistCard[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const shown = playlists.filter((p) => norm(p.title).includes(norm(q))).sort(SORTS[sort]);
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="field" type="search" placeholder="Поиск категории" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск категории" />
        <select className="field sm:!w-56" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="big">Больше песен</option>
          <option value="az">По алфавиту</option>
        </select>
      </div>
      {shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <PlaylistTile key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty title="Ничего не найдено" text={`Нет категорий по запросу «${q}».`} />
      )}
    </>
  );
}
