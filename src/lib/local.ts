// Клиентская часть: правила игры и всё, что хранится в браузере (аккаунтов нет).

// Обрезка проверена замером в Chromium: виджет останавливается в пределах ~5 мс от лимита.
export const LEVELS = [0.5, 1, 2, 5, 10, 15];
// Последнее значение — для подсказки на последнем уровне.
export const POINTS = [1000, 800, 600, 400, 200, 100, 50];
export const levelLabel = (i: number) => `${String(LEVELS[i]).replace('.', ',')} с`;

export type Attempt = 'skip' | 'wrong' | 'artist' | 'correct';
export type Progress = { level: number; hintUsed: boolean; attempts: Attempt[]; finished?: { won: boolean; points: number } };
export type Result = {
  mode: 'daily' | 'unlimited';
  trackId: string;
  won: boolean;
  points: number;
  level: number; // 1..6
  attempts: Attempt[];
  date: string; // YYYY-MM-DD (UTC)
};

export const today = () => new Date().toISOString().slice(0, 10);

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const results = () => load<Result[]>('gt:results', []);
export const recordResult = (r: Result) => save('gt:results', [...results(), r].slice(-3000));

export function dailyStreaks(all: Result[], now = today()) {
  const won = new Set(all.filter((r) => r.mode === 'daily' && r.won).map((r) => r.date));
  const played = new Set(all.filter((r) => r.mode === 'daily').map((r) => r.date));
  const prev = (d: string) => new Date(Date.parse(d) - 864e5).toISOString().slice(0, 10);
  let current = 0;
  // сегодняшний день ещё не сыгран — серия считается по вчерашний
  for (let d = played.has(now) ? now : prev(now); won.has(d); d = prev(d)) current++;
  let best = 0;
  for (const d of won) {
    if (won.has(prev(d))) continue;
    let n = 0;
    for (let x = d; won.has(x); x = new Date(Date.parse(x) + 864e5).toISOString().slice(0, 10)) n++;
    best = Math.max(best, n);
  }
  return { current, best };
}

const SQUARE: Record<Attempt, string> = { skip: '⬛', wrong: '🟥', artist: '🟨', correct: '🟩' };
// Один раунд по уровням: 🟥⬛🟩⬜⬜⬜
export const roundSquares = (attempts: Attempt[]) => attempts.map((a) => SQUARE[a]).join('') +'⬜'.repeat(Math.max(0, 6 - attempts.length));
// Один символ на раунд сессии.
export const roundDot = (r: { won: boolean; level: number }) => (!r.won ? '🟥' : r.level <= 2 ? '🟩' : r.level <= 4 ? '🟨' : '🟧');

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new Error('Нет соединения с сервером');
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.error ?? 'Ошибка сервера'), { status: r.status, data });
  return data as T;
}
export const post = (body: unknown, headers?: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
