import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackSelect } from '@/lib/data';
import { norm } from '@/lib/text';

const PAGE = 30;

// Каталог и поиск ответов в игре: по названию и исполнителю, по всей общей базе.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = norm(sp.get('q')?.slice(0, 100) ?? '');
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const where = { AND: q.split(' ').filter(Boolean).map((w) => ({ search: { contains: w } })) };
  const [items, total] = await Promise.all([
    db.track.findMany({
      where,
      orderBy: { createdAt: sp.get('sort') === 'old' ? 'asc' : 'desc' },
      skip: page * PAGE,
      take: PAGE,
      select: trackSelect,
    }),
    db.track.count({ where }),
  ]);
  return NextResponse.json({ items, total, hasMore: (page + 1) * PAGE < total });
}
