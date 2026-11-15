'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicTrack } from '@/lib/data';
import { api, load, post, save } from '@/lib/local';
import { Cover } from './ui';

type Item = Pick<PublicTrack, 'title' | 'artist' | 'artworkUrl' | 'soundcloudUrl'>;
type Props = { edit?: { id: string; token: string; title: string; description: string; items: Item[] } };

const MAX = 100;

// Одна форма для создания и для управления плейлистом.
export default function PlaylistForm({ edit }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(edit?.title ?? '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [items, setItems] = useState<Item[]>(edit?.items ?? []);
  const [link, setLink] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Принимает одну или несколько ссылок (по одной на строку).
  async function add(text: string) {
    const urls = text.split(/\s+/).filter(Boolean);
    if (!urls.length || adding) return;
    setAdding(true);
    setError('');
    const next = [...items];
    const problems: string[] = [];
    for (const url of urls) {
      if (next.length >= MAX) {
        problems.push(`Не больше ${MAX} треков в плейлисте`);
        break;
      }
      try {
        const t = await api<Item>(`/api/resolve?url=${encodeURIComponent(url)}`);
        if (next.some((i) => i.soundcloudUrl === t.soundcloudUrl)) problems.push(`«${t.title}» уже есть в этом плейлисте`);
        else next.push(t);
      } catch (e) {
        problems.push(`${url.slice(0, 60)} — ${(e as Error).message}`);
      }
      setItems([...next]);
    }
    setLink('');
    setError(problems.join('\n'));
    setAdding(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // защита от двойной отправки
    if (!title.trim()) return setError('Введите название плейлиста');
    if (!items.length) return setError('Добавьте хотя бы один трек');
    setSaving(true);
    setError('');
    const body = { title, description, urls: items.map((i) => i.soundcloudUrl) };
    try {
      if (edit) {
        await api(`/api/playlists/${edit.id}`, { ...post(body, { 'x-manage-token': edit.token }), method: 'PUT' });
        router.push(`/categories/${edit.id}?saved=1`);
      } else {
        const r = await api<{ id: string; token: string }>('/api/playlists', post(body));
        save('gt:tokens', { ...load<Record<string, string>>('gt:tokens', {}), [r.id]: r.token });
        router.push(`/categories/${r.id}?created=1`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass mx-auto flex max-w-2xl flex-col gap-5 p-5 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{edit ? 'Управление плейлистом' : 'Новый плейлист'}</h1>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Название *
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Например, Phonk для ночной дороги" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Описание
        <textarea className="field py-3" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Необязательно: что внутри" />
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-semibold">
        <label htmlFor="sc-link">Треки SoundCloud</label>
        <div className="flex gap-2">
          <input
            id="sc-link"
            className="field"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (/soundcloud\.com/.test(text)) {
                e.preventDefault();
                add(text);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(link);
              }
            }}
            placeholder="https://soundcloud.com/artist/track"
            inputMode="url"
          />
          <button type="button" className="btn shrink-0" disabled={adding || !link.trim()} onClick={() => add(link)}>
            {adding ? 'Проверяю…' : 'Добавить'}
          </button>
        </div>
        <p className="muted text-xs font-normal">Вставьте ссылку — название, исполнитель и обложка подтянутся из SoundCloud. Можно вставить сразу несколько ссылок, по одной на строку.</p>
      </div>

      {items.length > 0 && (
        <ol className="flex flex-col gap-2">
          {items.map((t, i) => (
            <li key={t.soundcloudUrl} className="animate-rise flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-2">
              <span className="muted w-5 text-center text-xs">{i + 1}</span>
              <Cover src={t.artworkUrl} small className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="muted truncate text-xs">{t.artist}</div>
              </div>
              <button
                type="button"
                className="btn !min-h-10 !px-3"
                aria-label={`Убрать «${t.title}»`}
                onClick={() => setItems(items.filter((x) => x !== t))}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm whitespace-pre-line text-red-200">
          {error}
        </p>
      )}
      <button className="btn btn-neon" disabled={saving || adding}>
        {saving ? 'Сохраняю…' : edit ? 'Сохранить изменения' : `Опубликовать плейлист${items.length ? ` (${items.length})` : ''}`}
      </button>
    </form>
  );
}
