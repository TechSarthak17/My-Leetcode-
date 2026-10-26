/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { problems } from '@/lib/problems';
import { connectDB, isDbConfigured } from '@/lib/db';
import Attempt from '@/models/Attempt';
import TrackedProblem from '@/models/TrackedProblem';
import { USER_ID } from '@/lib/user';

// Built-in practice questions (statement + starter code for the Python editor).
// `tracked` / `solved` are only true for questions the user has explicitly added to their tracked bank.
export async function GET() {
  let attempts: any[] = [];
  let trackedSlugs = new Set<string>();
  try {
    await connectDB();
    const [a, t]: [any[], any[]] = await Promise.all([
      Attempt.find({ userId: USER_ID }).select('problemSlug result').lean(),
      TrackedProblem.find({ userId: USER_ID }).select('slug').lean(),
    ]);
    attempts = a;
    trackedSlugs = new Set(t.map((x) => x.slug));
  } catch {
    /* the editor still works without a database */
  }
  const payload = problems.map((p) => {
    const mine = attempts.filter((a) => a.problemSlug === p.slug);
    const tracked = trackedSlugs.has(p.slug);
    return { ...p, tracked, solved: tracked && mine.some((a) => a.result === 'solved'), attempts: mine.length };
  });
  return NextResponse.json({ problems: payload, databaseConnected: isDbConfigured() });
}
