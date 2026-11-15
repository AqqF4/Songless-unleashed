import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => randomBytes(24).toString('base64url');
export const fail = (status: number, error: string, extra?: object) =>
  NextResponse.json({ error, ...extra }, { status });

// shortcut: in-memory per-process limiter, resets on restart; move to Redis/DB when running more than one instance
const hits = new Map<string, number[]>();
export function limited(req: Request, key: string, max: number, windowMs: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}
