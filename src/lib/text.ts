// Нормализация для поиска и сравнения: регистр, диакритика, ё/е, пунктуация, "&" = "and".
export const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const SPLIT = /\s*[,;]\s*|\s+(?:&|feat\.?|ft\.?|x|×|and|vs\.?)\s+/i;

// Все имена, под которыми трек может быть "этим исполнителем":
// загрузивший аккаунт, соавторы, feat. из названия и префикс "Артист - Песня".
export function artistsOf(artist: string, title: string): Set<string> {
  const names = artist.split(SPLIT);
  const feat = title.match(/[\s(\[](?:feat\.?|ft\.?)\s+([^)\]]+)/i);
  if (feat) names.push(...feat[1].split(SPLIT));
  const dash = title.split(/\s+[-–—]\s+/);
  if (dash.length > 1) names.push(...dash[0].split(SPLIT));
  return new Set(names.map(norm).filter(Boolean));
}

export function sameArtist(a: { artist: string; title: string }, b: { artist: string; title: string }) {
  const other = artistsOf(b.artist, b.title);
  for (const n of artistsOf(a.artist, a.title)) if (other.has(n)) return true;
  return false;
}
