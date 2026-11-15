export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10, b = n % 100;
  return `${n} ${a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many}`;
};
export const songs = (n: number) => plural(n, 'песня', 'песни', 'песен');
