/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attempt from '@/models/Attempt';
import TrackedProblem from '@/models/TrackedProblem';
import { USER_ID } from '@/lib/user';
import { istDate } from '@/lib/time';

export async function GET() {
  try {
    await connectDB();
    const [attempts, tracked]: [any[], any[]] = await Promise.all([
      Attempt.find({ userId: USER_ID }).sort({ createdAt: -1 }).limit(5000).select('problemSlug result createdAt').lean(),
      TrackedProblem.find({ userId: USER_ID }).sort({ createdAt: -1 }).limit(2000).lean(),
    ]);
    const solvedAttempts = attempts.filter((a) => a.result === 'solved').length;
    const accuracy = attempts.length ? Math.round((solvedAttempts / attempts.length) * 100) : 0;
    const activeDays = new Set(attempts.map((a) => istDate(new Date(a.createdAt)))).size;
    const topics: Record<string, number> = {};
    for (const t of tracked) { const k = t.topic || 'Imported'; topics[k] = (topics[k] ?? 0) + 1; }
    return NextResponse.json({
      ok: true,
      metrics: { tracked: tracked.length, attempts: attempts.length, solvedAttempts, accuracy, activeDays },
      topics: Object.entries(topics).map(([topic, total]) => ({ topic, total })),
      databaseConnected: true,
    });
  } catch (error) {
    console.error('[DSARecall diagnostics error]', error);
    return NextResponse.json(
      { ok: false, error: 'Diagnostics request failed.', detail: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined, metrics: { tracked: 0, attempts: 0, solvedAttempts: 0, accuracy: 0, activeDays: 0 }, topics: [], databaseConnected: false },
      { status: 500 },
    );
  }
}
