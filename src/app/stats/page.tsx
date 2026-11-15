'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Empty, Spinner } from '@/components/ui';
import { dailyStreaks, levelLabel, results, save, type Result } from '@/lib/local';

const MODES = [
  ['all', 'Все режимы'],
  ['daily', 'Daily'],
  ['unlimited', 'Unlimited'],
] as const;

export default function Stats() {
  const [all, setAll] = useState<Result[] | null>(null);
  const [mode, setMode] = useState<(typeof MODES)[number][0]>('all');
  useEffect(() => setAll(results()), []);
  if (!all) return <Spinner />;

  const rs = mode === 'all' ? all : all.filter((r) => r.mode === mode);
  const won = rs.filter((r) => r.won);
  const total = rs.reduce((a, r) => a + r.points, 0);
  const streak = dailyStreaks(all);
  const dist = [1, 2, 3, 4, 5, 6].map((l) => won.filter((r) => r.level === l).length).concat(rs.length - won.length);
  const maxDist = Math.max(1, ...dist);
  const recent = rs.slice(-30);

  const cards: [string, string | number][] = [
    ['Сыграно раундов', rs.length],
    ['Правильных ответов', won.length],
    ['Процент угаданных', rs.length ? `${Math.round((won.length / rs.length) * 100)}%` : '—'],
    ['Всего очков', total],
    ['Средний результат', rs.length ? Math.round(total / rs.length) : '—'],
    ['Лучший результат', rs.length ? Math.max(...rs.map((r) => r.points)) : '—'],
    ['Средний уровень угадывания', won.length ? (won.reduce((a, r) => a + r.level, 0) / won.length).toFixed(1) : '—'],
    ['Текущая серия Daily', `${streak.current} 🔥`],
    ['Лучшая серия Daily', streak.best],
  ];

  function reset() {
    if (!confirm('Сбросить всю статистику на этом устройстве? Отменить нельзя.')) return;
    save('gt:results', null);
    setAll([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Статистика</h1>
        <div className="glass flex !rounded-2xl p-1" role="tablist">
          {MODES.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${mode === id ? 'bg-neon/15 text-neon' : 'muted'}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!all.length ? (
        <Empty title="Пока пусто" text="Сыграйте первый раунд — статистика хранится только на этом устройстве.">
          <Link href="/play" className="btn btn-neon">
            Играть
          </Link>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {cards.map(([label, value]) => (
              <div key={label} className="glass !rounded-2xl p-4">
                <div className="text-2xl font-extrabold text-neon tabular-nums">{value}</div>
                <div className="muted text-xs">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="glass p-5">
              <h2 className="h-section">На каком уровне угадываете</h2>
              <div className="flex flex-col gap-2">
                {dist.map((n, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="muted w-16 shrink-0">{i < 6 ? levelLabel(i) : 'мимо'}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-lg bg-white/5">
                      <div
                        className={`h-full rounded-lg transition-[width] duration-700 ${i < 6 ? 'bg-neon shadow-[0_0_12px_rgb(57_255_136/0.5)]' : 'bg-red-400/70'}`}
                        style={{ width: `${(n / maxDist) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-bold tabular-nums">{n}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="glass flex flex-col p-5">
              <h2 className="h-section">Последние раунды</h2>
              <div className="flex min-h-40 flex-1 items-end gap-1" role="img" aria-label="Очки за последние раунды">
                {recent.map((r, i) => (
                  <div
                    key={i}
                    title={`${r.date}: ${r.points} очков`}
                    className={`flex-1 rounded-t-md ${r.won ? 'bg-neon/80' : 'bg-red-400/60'}`}
                    style={{ height: `${Math.max(4, r.points / 10)}%` }}
                  />
                ))}
              </div>
              <p className="muted mt-2 text-xs">Высота столбца — очки за раунд (максимум 1000)</p>
            </section>
          </div>

          <button className="btn mx-auto !border-red-400/30 !text-red-300" onClick={reset}>
            Сбросить статистику
          </button>
        </>
      )}
    </div>
  );
}
