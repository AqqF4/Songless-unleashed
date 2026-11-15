'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  ['/', 'Главная', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  ['/play', 'Играть', 'M7 4v16l13-8z'],
  ['/songs', 'Песни', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  ['/categories', 'Категории', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  ['/daily', 'Daily', 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4'],
  ['/artist', 'Артист дня', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'],
  ['/stats', 'Статистика', 'M5 20V10M12 20V4M19 20v-7'],
] as const;
// короткие подписи для нижнего меню на телефоне (7 вкладок в ряд)
const SHORT: Record<string, string> = { 'Артист дня': 'Артист', Статистика: 'Стат.' };

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="glass mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Link href="/" className="mr-2 flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-8 items-end gap-[3px] rounded-xl border border-neon/30 bg-neon/10 px-2 py-2 shadow-[0_0_18px_-4px_#39ff88]">
              <i className="h-2 w-1 rounded-full bg-neon" />
              <i className="h-4 w-1 rounded-full bg-neon" />
              <i className="h-3 w-1 rounded-full bg-neon" />
            </span>
            Glow<span className="-ml-2 text-neon">tune</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 xl:flex" aria-label="Основная навигация">
            {TABS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? 'page' : undefined}
                className={`rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  active(href) ? 'bg-neon/15 text-neon shadow-[inset_0_0_0_1px_rgb(57_255_136/0.35)]' : 'muted hover:text-emerald-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex gap-2">
            <Link href="/create" className="btn !min-h-10 !px-3 sm:!px-4">
              <span className="text-neon">＋</span>
              <span className="hidden whitespace-nowrap sm:inline">Создать плейлист</span>
              <span className="sm:hidden">Плейлист</span>
            </Link>
            <Link href="/play" className="btn btn-neon !min-h-10 !px-4">
              Играть
            </Link>
          </div>
        </div>
      </header>

      {/* мобильная навигация снизу — под большой палец */}
      <nav
        aria-label="Основная навигация"
        className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-7 !rounded-2xl p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] xl:hidden"
      >
        {TABS.map(([href, label, d]) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? 'page' : undefined}
            aria-label={label}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-semibold transition ${
              active(href) ? 'bg-neon/15 text-neon' : 'muted'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
              <path d={d} />
            </svg>
            <span className="max-w-full truncate">{SHORT[label] ?? label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
