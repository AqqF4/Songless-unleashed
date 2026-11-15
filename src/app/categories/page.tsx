import Link from 'next/link';
import { listPlaylists } from '@/lib/data';
import { Empty } from '@/components/ui';
import CategoryGrid from './CategoryGrid';

export const metadata = { title: 'Категории' };

export default async function Categories() {
  const playlists = await listPlaylists();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Категории</h1>
        <Link href="/create" className="btn">
          <span className="text-neon">＋</span> Создать плейлист
        </Link>
      </div>
      {playlists.length ? (
        <CategoryGrid playlists={playlists} />
      ) : (
        <Empty title="Категорий пока нет" text="Каждый публичный плейлист становится игровой категорией. Создайте первый.">
          <Link href="/create" className="btn btn-neon">
            Создать плейлист
          </Link>
        </Empty>
      )}
    </div>
  );
}
