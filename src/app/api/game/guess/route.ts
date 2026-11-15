import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail } from '@/lib/server';
import { sameArtist } from '@/lib/text';

// Проверка ответа по общей базе: correct | artist (исполнитель верный, песня другая) | wrong.
export async function POST(req: Request) {
  const { trackId, guessId } = (await req.json().catch(() => ({}))) as { trackId?: string; guessId?: string };
  if (typeof trackId !== 'string' || typeof guessId !== 'string') return fail(400, 'Некорректный запрос');
  if (trackId === guessId) return NextResponse.json({ result: 'correct' });
  const select = { artist: true, title: true };
  const [answer, guess] = await Promise.all([
    db.track.findUnique({ where: { id: trackId }, select }),
    db.track.findUnique({ where: { id: guessId }, select }),
  ]);
  if (!answer || !guess) return fail(404, 'Трек не найден в базе');
  return NextResponse.json({ result: sameArtist(answer, guess) ? 'artist' : 'wrong' });
}
