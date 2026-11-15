'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Round, { type RoundInfo } from '@/components/Round';
import { Empty, ShareButton, Spinner } from '@/components/ui';
import { songs } from '@/lib/format';
import type { PlaylistCard } from '@/lib/data';
import { api, load, post, recordResult, roundDot, save, today, type Progress, type Result } from '@/lib/local';

type Session = { source: string[]; played: string[]; results: Result[]; round: RoundInfo | null; progress?: Progress; left?: number };
const KEY = 'gt:session';

export default function Play() {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'summary'>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [resumable, setResumable] = useState<Session | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistCard[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<Session | null>(null);

  const update = (s: Session) => {
    ref.current = s;
    setSession(s);
    save(KEY, s);
  };

  async function nextRound(s: Session) {
    setLoading(true);
    setError('');
    try {
      const r = await api<(RoundInfo & { left: number; done?: undefined }) | { done: true }>('/api/game/next', post({ playlistIds: s.source, exclude: s.played }));
      if (r.done) {
        // все треки источника отгаданы или пропущены — итоги
        update(s);
        endSession();
      } else {
        update({ ...s, round: { id: r.id, soundcloudId: r.soundcloudId }, progress: undefined, played: [...s.played, r.id], left: r.left });
        setPhase('playing');
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }
  const start = (source: string[]) => nextRound({ source, played: [], results: [], round: null });

  useEffect(() => {
    const playlist = new URLSearchParams(location.search).get('playlist');
    if (playlist) {
      start([playlist]);
      return;
    }
    const saved = load<Session | null>(KEY, null);
    if (saved?.round) setResumable(saved);
    api<PlaylistCard[]>('/api/playlists').then(setPlaylists, (e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function endSession() {
    save(KEY, null);
    setPhase('summary');
  }
  function newSession() {
    setSession(null);
    setResumable(null);
    setPhase('setup');
    if (!playlists) api<PlaylistCard[]>('/api/playlists').then(setPlaylists, (e) => setError(e.message));
  }

  if (error)
    return (
      <Empty title="Не получилось начать игру" text={error}>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={() => (session ? nextRound(session) : (setError(''), newSession()))}>
            Повторить
          </button>
          <Link href="/create" className="btn btn-neon">
            Создать плейлист
          </Link>
        </div>
      </Empty>
    );

  if (phase === 'playing' && session?.round) {
    const total = session.results.reduce((a, r) => a + r.points, 0);
    const done = !!session.progress?.finished;
    return (
      <div className="flex flex-col gap-4">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 text-sm">
          <span className="muted">
            Раунд {session.results.length + (done ? 0 : 1)}
            {session.left !== undefined && ` · осталось ${session.left}`}
          </span>
          <span className="font-bold">
            Счёт: <span className="text-neon tabular-nums">{total}</span>
          </span>
        </div>
        {loading ? (
          <Spinner label="Подбираю и проверяю следующий трек…" />
        ) : (
          <Round
            key={session.round.id + session.played.length}
            round={session.round}
            saved={session.progress}
            onProgress={(progress) => ref.current && update({ ...ref.current, progress })}
            onFinish={(r) => {
              const result: Result = { mode: 'unlimited', trackId: session.round!.id, date: today(), ...r };
              recordResult(result);
              update({ ...ref.current!, results: [...ref.current!.results, result] });
            }}
            onBroken={() => nextRound(ref.current!)}
            footer={
              <>
                <button className="btn btn-neon" autoFocus onClick={() => nextRound(ref.current!)}>
                  {session.left === 0 ? 'Показать итоги →' : 'Следующий трек →'}
                </button>
                <button className="btn" onClick={endSession}>
                  Завершить сессию
                </button>
              </>
            }
          />
        )}
        {!done && !loading && (
          <button className="muted mx-auto text-sm underline-offset-2 hover:underline" onClick={endSession}>
            Завершить сессию
          </button>
        )}
      </div>
    );
  }

  if (phase === 'summary' && session) {
    const rs = session.results;
    const won = rs.filter((r) => r.won);
    const total = rs.reduce((a, r) => a + r.points, 0);
    const avg = won.length ? (won.reduce((a, r) => a + r.level, 0) / won.length).toFixed(1) : '—';
    const text = `Glowtune ∞ — угадано ${won.length}/${rs.length}, ${total} очков\n${rs.map(roundDot).join('')}\n${location.origin}`;
    return (
      <div className="glass animate-pop mx-auto flex max-w-xl flex-col items-center gap-5 p-8 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-neon uppercase">Сессия завершена</p>
        <p className="text-6xl font-extrabold text-neon tabular-nums drop-shadow-[0_0_24px_rgb(57_255_136/0.5)]">{total}</p>
        <div className="grid w-full grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="text-xl font-bold">
              {won.length} из {rs.length}
            </div>
            <div className="muted">угадано</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="text-xl font-bold">{avg}</div>
            <div className="muted">средний уровень</div>
          </div>
        </div>
        {rs.length > 0 && (
          <ol className="flex flex-wrap justify-center gap-1 text-2xl" aria-label="Результаты раундов">
            {rs.map((r, i) => (
              <li key={i} title={r.won ? `Раунд ${i + 1}: уровень ${r.level}, +${r.points}` : `Раунд ${i + 1}: не угадано`}>
                {roundDot(r)}
              </li>
            ))}
          </ol>
        )}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {rs.length > 0 && <ShareButton text={text} />}
          <button className="btn btn-neon" onClick={newSession}>
            Играть ещё
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner label="Подбираю трек…" />;

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Unlimited</h1>
      {resumable && (
        <div className="glass flex flex-col gap-3 !rounded-2xl p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            Есть незавершённая сессия: {resumable.results.length} раундов, {resumable.results.reduce((a, r) => a + r.points, 0)} очков.
          </p>
          <button className="btn btn-neon !min-h-10" onClick={() => (update(resumable), setPhase('playing'))}>
            Продолжить
          </button>
        </div>
      )}
      <div className="glass flex flex-col gap-4 p-5">
        <h2 className="font-bold">Откуда брать песни?</h2>
        <button
          className={`btn !justify-start ${!chosen.length ? '!border-neon/60 !bg-neon/15 text-neon' : ''}`}
          aria-pressed={!chosen.length}
          onClick={() => setChosen([])}
        >
          Все песни из общей библиотеки
        </button>
        {!playlists ? (
          <Spinner label="Загружаю категории…" />
        ) : (
          playlists.length > 0 && (
            <>
              <p className="muted text-sm">…или одна либо несколько категорий:</p>
              <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    className={`btn !min-h-10 ${chosen.includes(p.id) ? '!border-neon/60 !bg-neon/15 text-neon' : ''}`}
                    aria-pressed={chosen.includes(p.id)}
                    onClick={() => toggle(p.id)}
                  >
                    {p.title} <span className="muted text-xs font-normal">{songs(p.count)}</span>
                  </button>
                ))}
              </div>
            </>
          )
        )}
        <button className="btn btn-neon" onClick={() => start(chosen)}>
          ▶ Начать игру
        </button>
      </div>
    </div>
  );
}
