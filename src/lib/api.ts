import { NextResponse } from 'next/server';

export function fail(error: unknown, label: string) {
  console.error(`[DSARecall ${label}]`, error);
  const message = error instanceof Error ? error.message : String(error);
  const missing = message.startsWith('Missing MONGODB_URI');
  return NextResponse.json(
    {
      ok: false,
      error: missing ? 'MongoDB is not configured. Set MONGODB_URI in .env.local.' : 'Database error. Please try again.',
      detail: process.env.NODE_ENV === 'development' ? message : undefined,
    },
    { status: 503 },
  );
}

export const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

export const isDuplicateKey = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
