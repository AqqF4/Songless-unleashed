// Единственный источник музыки. Метаданные — официальный oEmbed; если заданы ключи API, ещё и длительность.

export class ScError extends Error {}

export type ScTrack = {
  soundcloudId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  soundcloudUrl: string;
  durationMs: number | null;
};

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; music-quiz/1.0)' };

// Приводит ссылку к каноническому виду https://soundcloud.com/user/track или бросает ScError.
export async function canonicalUrl(input: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new ScError('Это не ссылка');
  }
  let host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host === 'on.soundcloud.com') {
    // короткая ссылка: читаем только заголовок Location, никуда кроме soundcloud.com не идём
    const r = await fetch(`https://on.soundcloud.com${u.pathname}`, { redirect: 'manual', headers: UA }).catch(() => null);
    const loc = r?.headers.get('location');
    if (!loc) throw new ScError('Короткая ссылка SoundCloud не открывается');
    u = new URL(loc);
    host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  }
  if (!/^https?:$/.test(u.protocol) || host !== 'soundcloud.com') throw new ScError('Нужна ссылка на трек soundcloud.com');
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts[1] === 'sets') throw new ScError('Нужна ссылка на отдельный трек, а не на профиль или плейлист');
  return `https://soundcloud.com/${parts[0]}/${parts[1]}`.toLowerCase();
}

async function oembed(url: string) {
  return fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, { headers: UA, cache: 'no-store' });
}

// null = сеть недоступна (не знаем), true/false = SoundCloud ответил.
export async function isAvailable(url: string): Promise<boolean | null> {
  const r = await oembed(url).catch(() => null);
  if (!r || r.status >= 500 || r.status === 429) return null;
  return r.ok;
}

// Профиль артиста по слагу (soundcloud.com/<slug>): имя и аватарка из oEmbed.
export async function resolveArtist(slug: string): Promise<{ name: string; avatarUrl: string | null }> {
  if (!/^[a-z0-9_-]{1,100}$/i.test(slug)) throw new ScError('Некорректный профиль');
  const r = await oembed(`https://soundcloud.com/${slug}`).catch(() => null);
  if (!r?.ok) throw new ScError('Профиль SoundCloud недоступен');
  const d = (await r.json()) as { author_name?: string; thumbnail_url?: string; html?: string };
  if (!d.author_name || !/api\.soundcloud\.com(%2F|\/)users/i.test(d.html ?? '')) throw new ScError('Это не профиль артиста');
  let avatarUrl: string | null = null;
  try {
    const a = new URL(d.thumbnail_url ?? '');
    if (a.protocol === 'https:' && a.hostname.endsWith('.sndcdn.com') && !a.pathname.includes('default_avatar')) avatarUrl = a.href;
  } catch {}
  return { name: d.author_name, avatarUrl };
}

export async function resolveTrack(url: string): Promise<ScTrack> {
  const r = await oembed(url).catch(() => null);
  if (!r) throw new ScError('SoundCloud не отвечает, попробуйте позже');
  if (r.status === 404) throw new ScError('Трек не найден на SoundCloud');
  if (r.status === 401 || r.status === 403) throw new ScError('Трек закрыт или запрещён для встраивания');
  if (!r.ok) throw new ScError('SoundCloud не отвечает, попробуйте позже');
  const d = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string; html?: string };

  // src виджета: ...api.soundcloud.com%2Ftracks%2F293 или ...tracks%2Fsoundcloud%253Atracks%253A293
  const sep = '(?:%253A|%3A|:)';
  const id = (d.html ?? '').match(new RegExp(`api\\.soundcloud\\.com(?:%2F|/)tracks(?:%2F|/)(?:soundcloud${sep}tracks${sep})?(\\d+)`, 'i'))?.[1];
  if (!id || !d.title || !d.author_name) throw new ScError('По ссылке не трек (возможно, профиль или плейлист)');

  const suffix = ` by ${d.author_name}`;
  const title = d.title.endsWith(suffix) ? d.title.slice(0, -suffix.length) : d.title;
  let artworkUrl: string | null = null;
  try {
    const a = new URL(d.thumbnail_url ?? '');
    if (a.protocol === 'https:' && a.hostname.endsWith('.sndcdn.com')) artworkUrl = a.href;
  } catch {}

  const api = await apiTrack(id).catch(() => null);
  if (api?.access === 'blocked') throw new ScError('Трек недоступен для воспроизведения');
  return { soundcloudId: id, title, artist: d.author_name, artworkUrl, soundcloudUrl: url, durationMs: api?.duration ?? null };
}

// Официальный API (client credentials). Работает только если заданы SOUNDCLOUD_CLIENT_ID/SECRET.
let token: { value: string; exp: number } | null = null;
async function apiTrack(id: string): Promise<{ duration?: number; access?: string } | null> {
  const { SOUNDCLOUD_CLIENT_ID: cid, SOUNDCLOUD_CLIENT_SECRET: secret } = process.env;
  if (!cid || !secret) return null;
  if (!token || token.exp < Date.now()) {
    const r = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${cid}:${secret}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) return null;
    const t = (await r.json()) as { access_token: string; expires_in: number };
    token = { value: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
  }
  const r = await fetch(`https://api.soundcloud.com/tracks/${id}`, { headers: { authorization: `OAuth ${token.value}` } });
  return r.ok ? r.json() : null;
}
