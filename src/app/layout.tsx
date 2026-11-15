import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { db } from '@/lib/db';
import Nav from '@/components/Nav';
import './globals.css';

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' });

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { themeColor: '#030806' };

export async function generateMetadata(): Promise<Metadata> {
  // v меняется с каждым новым треком, поэтому браузер перезапрашивает иконку-коллаж
  const last = await db.track.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } }).catch(() => null);
  const v = last?.id ?? '0';
  return {
    title: { default: 'Glowtune — угадай трек по первым секундам', template: '%s · Glowtune' },
    description: 'Музыкальная игра на треках SoundCloud: общая библиотека, плейлисты без регистрации, Daily и Unlimited.',
    icons: { icon: `/api/icon?size=64&v=${v}`, apple: `/api/icon?size=180&v=${v}` },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 xl:pb-16">{children}</main>
      </body>
    </html>
  );
}
