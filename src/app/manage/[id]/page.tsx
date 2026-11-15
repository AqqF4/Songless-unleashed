'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PlaylistForm from '@/components/PlaylistForm';
import { Empty, Spinner } from '@/components/ui';
import type { PublicTrack } from '@/lib/data';
import { api, load, save } from '@/lib/local';

type Playlist = { id: string; title: string; description: string | null; tracks: PublicTrack[] };

// Приватная страница управления. Токен приходит в #hash (не уходит на сервер в URL) или из localStorage.
export default function Manage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [p, setP] = useState<Playlist | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const tokens = load<Record<string, string>>('gt:tokens', {});
    const fromHash = location.hash.slice(1);
    if (fromHash) save('gt:tokens', { ...tokens, [id]: fromHash });
    setToken(fromHash || tokens[id] || '');
    api<Playlist>(`/api/playlists/${id}`).then(setP, (e) => setError(e.message));
  }, [id]);

  async function remove() {
    if (!confirm('Удалить плейлист? Треки останутся в общей библиотеке. Отменить нельзя.')) return;
    try {
      await api(`/api/playlists/${id}`, { method: 'DELETE', headers: { 'x-manage-token': token! } });
      router.push('/categories');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <Empty title="Не получилось" text={error} />;
  if (!p || token === null) return <Spinner label="Загрузка плейлиста…" />;
  if (!token) return <Empty title="Нет доступа" text="Управлять плейлистом можно только по приватной ссылке, полученной при создании." />;
  return (
    <div className="flex flex-col gap-4">
      <PlaylistForm edit={{ id, token, title: p.title, description: p.description ?? '', items: p.tracks }} />
      <button className="btn mx-auto !border-red-400/30 !text-red-300" onClick={remove}>
        Удалить плейлист
      </button>
    </div>
  );
}
