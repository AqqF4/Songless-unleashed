import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail } from '@/lib/server';

// Подсказка: только исполнитель, без названия.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const t = await db.track.findUnique({ where: { id }, select: { artist: true } });
  return t ? NextResponse.json({ artist: t.artist }) : fail(404, 'Трек не найден');
}
