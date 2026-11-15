'use client';
import { useEffect, useRef, useState } from 'react';
import type { PublicTrack } from '@/lib/data';
import { api, LEVELS, levelLabel, POINTS, post, type Attempt, type Progress } from '@/lib/local';
import { Cover } from './ui';
import { useScPlayer } from './useScPlayer';

export type RoundInfo = { id: string; soundcloudId: string };
type Props = {
  round: RoundInfo;
  saved?: Progress;
  onProgress: (p: Progress) => void; // сохранение незавершённого раунда
  onFinish: (r: { won: boolean; points: number; level: number; attempts: Attempt[] }) => void;
  onBroken?: () => void; // "пропустить композицию", если трек не играет
  footer?: React.ReactNode; // кнопки после раунда
};

const BAR = 15; // секунд на шкале — последний уровень

export default function Round({ round, saved, onProgress, onFinish, onBroken, footer }: Props) {
  const [level, setLevel] = useState(saved?.level ?? 0);
  const [hintUsed, setHintUsed] = useState(saved?.hintUsed ?? false);
  const [attempts, setAttempts] = useState<Attempt[]>(saved?.attempts ?? []);
  const [finished, setFinished] = useState(saved?.finished ?? null);
  const [hint, setHint] = useState('');
  const [track, setTrack] = useState<PublicTrack | null>(null);
  const [notice, setNotice] = useState<{ kind: 'bad' | 'warn' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  const [q, setQ] = useState('');
  const [options, setOptions] = useState<PublicTrack[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<PublicTrack | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const player = useScPlayer(round.soundcloudId, finished ? Infinity : LEVELS[level], !finished);
  const potential = POINTS[level + (hintUsed ? 1 : 0)];

  useEffect(() => {
    onProgress({ level, hintUsed, attempts, finished: finished ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, hintUsed, attempts, finished]);

  // раскрытие ответа — только после конца раунда; подсказка восстанавливается после перезагрузки
  useEffect(() => {
    if (finished) api<PublicTrack>(`/api/tracks/${round.id}`).then(setTrack, () => {});
    else if (hintUsed) api<{ artist: string }>(`/api/game/hint?id=${round.id}`).then((h) => setHint(h.artist), () => {});
  }, [finished, hintUsed, round.id]);

  // поиск ответа по общей базе
  useEffect(() => {
    if (!q.trim() || picked?.title === q) return setOptions([]);
    let stale = false;
    const t = setTimeout(() => {
      api<{ items: PublicTrack[] }>(`/api/tracks?q=${encodeURIComponent(q)}`).then(
        (d) => !stale && (setOptions(d.items), setCursor(0), setOpen(true)),
        () => {},
      );
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, picked]);

  function finish(won: boolean, all: Attempt[]) {
    const points = won ? potential : 0;
    setFinished({ won, points });
    setNotice(null);
    onFinish({ won, points, level: level + 1, attempts: all });
  }
  function advance(a: Attempt) {
    const all = [...attempts, a];
    setAttempts(all);
    player.pause();
    if (level >= LEVELS.length - 1) finish(false, all);
    else setLevel(level + 1);
  }
  function skip() {
    setNotice({ kind: 'info', text: level >= LEVELS.length - 1 ? '' : `Пропуск. Открыт фрагмент: ${levelLabel(level + 1)}` });
    advance('skip');
  }
  async function guess() {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const { result } = await api<{ result: Attempt }>('/api/game/guess', post({ trackId: round.id, guessId: picked.id }));
      if (result === 'correct') {
        setAttempts([...attempts, 'correct']);
        finish(true, [...attempts, 'correct']);
      } else {
        setNotice(
          result === 'artist'
            ? { kind: 'warn', text: 'Исполнитель угадан, но это другая песня!' }
            : { kind: 'bad', text: `Неверно: «${picked.title}» — не тот трек.` },
        );
        advance(result);
      }
      setPicked(null);
      setQ('');
    } catch (e) {
      setNotice({ kind: 'bad', text: (e as Error).message });
    }
    setBusy(false);
  }
  async function showHint() {
    try {
      const h = await api<{ artist: string }>(`/api/game/hint?id=${round.id}`);
      setHint(h.artist);
      setHintUsed(true);
    } catch (e) {
      setNotice({ kind: 'bad', text: (e as Error).message });
    }
  }
  async function report(reason: string) {
    setReported(true);
    await api(`/api/tracks/${round.id}`, post({ reason })).catch(() => {});
  }
  const toggle = () => (player.state === 'playing' ? player.pause() : player.play());
  const choose = (t: PublicTrack) => {
    setPicked(t);
    setQ(t.title);
    setOpen(false);
    input.current?.focus();
  };

  // горячие клавиши: пробел — играть/пауза (вне полей ввода)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(el.tagName)) return;
      e.preventDefault();
      if (player.state === 'playing') player.pause();
      else if (player.state === 'ready') player.play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const limit = finished ? Infinity : LEVELS[level];
  const pct = (sec: number) => `${(Math.min(sec, BAR) / BAR) * 100}%`;

  return (
    <div className="glass mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:p-7">
      {/* Виджет SoundCloud: во время раунда скрыт (он показывает название), после — виден целиком */}
      <div className={finished ? 'animate-rise overflow-hidden rounded-2xl' : 'pointer-events-none absolute h-px w-px overflow-hidden opacity-0'} aria-hidden={!finished}>
        <iframe
          key={player.frameKey}
          ref={player.iframe}
          src={player.src}
          title="SoundCloud player"
          width="100%"
          height="120"
          allow="autoplay"
          tabIndex={finished ? 0 : -1}
          className="block border-0"
        />
      </div>

      {finished ? (
        <div className="animate-pop flex flex-col items-center gap-4 text-center">
          <p className={`text-sm font-bold tracking-[0.25em] uppercase ${finished.won ? 'text-neon' : 'text-red-300'}`}>
            {finished.won ? `Угадано на уровне ${attempts.length}` : 'Не угадано'}
          </p>
          <Cover src={track?.artworkUrl ?? null} className="h-52 w-52 rounded-3xl shadow-[0_0_60px_-12px_rgb(57_255_136/0.6)]" />
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-balance">{track?.title ?? '…'}</h2>
            <p className="muted">{track?.artist}</p>
          </div>
          <p className="text-4xl font-extrabold text-neon tabular-nums">+{finished.points}</p>
          {track && (
            <a href={track.soundcloudUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-neon hover:underline">
              Слушать на SoundCloud ↗
            </a>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">{footer}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="muted text-xs font-semibold">Уровень {level + 1} из 6</p>
              <p key={level} className="animate-pop text-2xl font-extrabold tracking-tight">
                {levelLabel(level)}
              </p>
            </div>
            <div className="text-right">
              <p className="muted text-xs font-semibold">Очки за ответ</p>
              <p className="text-2xl font-extrabold text-neon tabular-nums">{potential}</p>
            </div>
          </div>

          {/* шкала уровней + ползунок перемотки внутри открытого фрагмента */}
          <div className="relative flex h-6 items-center">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 bg-neon/25 transition-[width] duration-500" style={{ width: pct(limit) }} />
              <div className="absolute inset-y-0 left-0 bg-neon shadow-[0_0_12px_#39ff88]" style={{ width: pct(Math.min(player.pos / 1000, limit)) }} />
              {LEVELS.slice(0, 5).map((s) => (
                <i key={s} className="absolute inset-y-0 w-px bg-black/60" style={{ left: pct(s) }} />
              ))}
            </div>
            <input
              type="range"
              className="scrub absolute inset-0"
              min={0}
              max={BAR * 1000}
              step={50}
              value={Math.min(player.pos, limit * 1000)}
              disabled={player.state === 'loading' || player.state === 'error'}
              onChange={(e) => player.seek(Math.min(+e.target.value, limit * 1000))}
              aria-label={`Позиция прослушивания, открыт фрагмент ${levelLabel(level)}`}
              aria-valuetext={`${(player.pos / 1000).toFixed(1)} с из ${levelLabel(level)}`}
            />
          </div>

          {player.state === 'error' ? (
            <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm">
              <p className="font-semibold text-red-200">Трек не воспроизводится. Возможно, он удалён или недоступен в вашем регионе.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn !min-h-10" onClick={player.retry}>
                  Повторить загрузку
                </button>
                {onBroken && (
                  <button className="btn !min-h-10" onClick={() => (report('not_playable'), onBroken())}>
                    Пропустить композицию
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button
                className="btn btn-neon !h-16 !w-16 shrink-0 !rounded-full !p-0 text-2xl"
                onClick={toggle}
                disabled={player.state === 'loading'}
                aria-label={player.state === 'playing' ? 'Пауза' : 'Слушать фрагмент'}
              >
                {player.state === 'loading' ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-950/30 border-t-emerald-950" />
                ) : player.state === 'playing' ? (
                  '❚❚'
                ) : (
                  '▶'
                )}
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold" role="status">
                  {player.state === 'loading' ? 'Загружаю аудио…' : player.state === 'playing' ? 'Играет…' : 'Нажмите, чтобы послушать'}
                </p>
                <p className="muted text-xs">Повтор не отнимает очки · пробел — играть/пауза</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span aria-hidden>🔊</span>
                <input type="range" min={0} max={100} value={player.volume} onChange={(e) => player.setVolume(+e.target.value)} className="w-20 sm:w-28" aria-label="Громкость" />
              </label>
            </div>
          )}

          {hint && (
            <p className="animate-rise rounded-2xl border border-neon/30 bg-neon/10 p-3 text-sm">
              Исполнитель: <b className="text-neon">{hint}</b>
            </p>
          )}
          {notice?.text && (
            <p
              role="alert"
              key={attempts.length}
              className={`animate-pop rounded-2xl border p-3 text-sm font-semibold ${
                notice.kind === 'warn' ? 'border-amber-300/40 bg-amber-400/10 text-amber-200' : notice.kind === 'bad' ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-white/10 bg-white/5'
              }`}
            >
              {notice.text}
            </p>
          )}

          {/* поиск ответа */}
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              guess();
            }}
          >
            <div className="flex gap-2">
              <input
                ref={input}
                className="field"
                placeholder="Название песни или исполнитель"
                value={q}
                onChange={(e) => (setQ(e.target.value), setPicked(null))}
                onFocus={() => options.length && setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), setCursor((c) => Math.min(c + 1, options.length - 1)));
                  if (e.key === 'ArrowUp') (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
                  if (e.key === 'Escape') setOpen(false);
                  // Enter: сначала выбрать подсвеченный вариант, вторым нажатием — ответить
                  // (отключённая кнопка блокирует нативную отправку формы, поэтому обрабатываем сами)
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (picked) guess();
                    else if (options[cursor]) choose(options[cursor]);
                  }
                }}
                role="combobox"
                aria-expanded={open}
                aria-controls="answers"
                aria-autocomplete="list"
                autoComplete="off"
              />
              <button className="btn btn-neon shrink-0" disabled={!picked || busy}>
                Ответить
              </button>
            </div>
            {open && q.trim() && !picked && (
              <ul id="answers" role="listbox" className="glass absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto !rounded-2xl !bg-[#07140d]/95 p-1">
                {options.length ? (
                  options.map((t, i) => (
                    <li key={t.id} role="option" aria-selected={i === cursor}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${i === cursor ? 'bg-neon/15' : 'hover:bg-white/5'}`}
                        onClick={() => choose(t)}
                        onMouseEnter={() => setCursor(i)}
                      >
                        <Cover src={t.artworkUrl} small className="h-10 w-10 shrink-0 rounded-lg" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{t.title}</span>
                          <span className="muted block truncate text-xs">{t.artist}</span>
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="muted p-3 text-sm">В базе нет таких треков</li>
                )}
              </ul>
            )}
          </form>

          <div className="flex flex-wrap gap-2">
            <button className="btn flex-1" onClick={skip}>
              {level >= LEVELS.length - 1 ? 'Сдаться' : `Пропустить → ${levelLabel(level + 1)}`}
            </button>
            <button className="btn flex-1" onClick={showHint} disabled={hintUsed}>
              {hintUsed ? 'Подсказка использована' : 'Подсказка об авторе'}
            </button>
          </div>
        </>
      )}

      <div className="muted flex items-center justify-between text-xs">
        <span>Музыка — SoundCloud</span>
        <button className="underline-offset-2 hover:underline disabled:no-underline" disabled={reported} onClick={() => report('user_report')}>
          {reported ? 'Спасибо, проверим' : 'Сообщить о проблеме с треком'}
        </button>
      </div>
    </div>
  );
}
