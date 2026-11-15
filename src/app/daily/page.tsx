'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Round, { type RoundInfo } from '@/components/Round';
import { Countdown, Empty, ShareButton, Spinner } from '@/components/ui';
import { api, dailyStreaks, load, recordResult, results, roundSquares, save, type Progress } from '@/lib/local';

type Daily = RoundInfo & { date: string };
type Stored = { date: string; progress: Progress };

export default function DailyPage() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [progress, setProgress] = useState<Progress | undefined>();
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);

  useEffect(() => {
    api<Daily>('/api/daily').then(
      (d) => {
        const stored = load<Stored | null>('gt:daily', null);
        if (stored?.date === d.date) setProgress(stored.progress);
        setDaily(d);
      },
      (e) => setError(e),
    );
  }, []);

  if (error)
    return error.status === 404 ? (
      <Empty title="Daily пока нет" text="В общей базе ещё нет песен. Создайте первый плейлист — и ежедневное испытание появится.">
        <Link href="/create" className="btn btn-neon">
          Создать плейлист
        </Link>
      </Empty>
    ) : (
      <Empty title="Не удалось загрузить Daily" text={error.message}>
        <button className="btn" onClick={() => location.reload()}>
          Повторить
        </button>
      </Empty>
    );
  if (!daily) return <Spinner label="Загружаю испытание дня…" />;

  const fin = progress?.finished;
  const streak = dailyStreaks(results(), daily.date);
  const text = fin
    ? `Glowtune Daily ${daily.date}\n${roundSquares(progress!.attempts)} ${fin.won ? `${fin.points} очков` : 'не угадано'}\nСерия: ${streak.current} 🔥\n${location.origin}/daily`
    : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-2xl items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.3em] text-neon uppercase">Daily Challenge</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {new Date(daily.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
          </h1>
        </div>
        <p className="muted text-right text-xs">
          Одна песня для всех
          <br />
          обновление в 00:00 UTC
        </p>
      </div>

      <Round
        key={daily.date}
        round={daily}
        saved={progress}
        onProgress={(p) => {
          setProgress(p);
          save('gt:daily', { date: daily.date, progress: p });
        }}
        onFinish={(r) => recordResult({ mode: 'daily', trackId: daily.id, date: daily.date, ...r })}
        footer={
          <>
            <ShareButton text={text} className="btn btn-neon" />
            <Link href="/play" className="btn">
              Играть ещё в Unlimited
            </Link>
          </>
        }
      />

      {fin && (
        <div className="animate-rise mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            [fin.won ? `Уровень ${progress!.attempts.length}` : 'Мимо', 'результат'],
            [fin.points, 'очков'],
            [`${streak.current} 🔥`, `серия (лучшая ${streak.best})`],
            [<Countdown key="c" />, 'до следующего Daily'],
          ].map(([value, label], i) => (
            <div key={i} className="glass !rounded-2xl p-4">
              <div className="text-xl font-extrabold">{value}</div>
              <div className="muted text-xs">{label}</div>
            </div>
          ))}
          <p className="col-span-full text-2xl tracking-widest" aria-label="Ход раунда">
            {roundSquares(progress!.attempts)}
          </p>
        </div>
      )}
    </div>
  );
}
