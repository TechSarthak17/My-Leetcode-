/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { fail } from '@/lib/api';
import { USER_ID } from '@/lib/user';
import { istDate, istDayRange, istTime } from '@/lib/time';
import { leetcodeUrl } from '@/lib/leetcode';
import { titleMap } from '@/lib/revision';
import Attempt from '@/models/Attempt';
import RevisionSession from '@/models/RevisionSession';
import TrackedProblem from '@/models/TrackedProblem';

/** Dashboard numbers, all computed from MongoDB at request time. */
export async function GET() {
  try {
    await connectDB();
    const today = istDate();
    const { start, end } = istDayRange(today);
    const [trackedQuestions, byResult, todaySlugs, sessions, recentRows]: [number, any[], string[], any[], any[]] = await Promise.all([
      TrackedProblem.countDocuments({ userId: USER_ID }),
      Attempt.aggregate([{ $match: { userId: USER_ID } }, { $group: { _id: '$result', n: { $sum: 1 } } }]),
      Attempt.distinct('problemSlug', { userId: USER_ID, createdAt: { $gte: start, $lt: end } }),
      RevisionSession.find({ userId: USER_ID, localDate: today }).sort({ createdAt: 1 }).lean(),
      Attempt.find({ userId: USER_ID }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);
    const n = (k: string) => byResult.find((r) => r._id === k)?.n ?? 0;
    const totalAttempts = byResult.reduce((sum, r) => sum + r.n, 0);

    // Daily session progress (answered = attempts stored for that session id).
    const daily = sessions.find((s) => s.type === 'daily');
    let dailyProgress: { exists: boolean; answered: number; total: number; status: string } = { exists: false, answered: 0, total: 0, status: 'none' };
    if (daily) {
      const answered = await Attempt.countDocuments({ userId: USER_ID, sessionId: daily.sessionId });
      const total = daily.questionSlugs.length;
      dailyProgress = { exists: true, answered, total, status: answered >= total ? 'completed' : 'active' };
    }

    const titles = await titleMap([...new Set(recentRows.map((r) => r.problemSlug as string))]);
    const recent = recentRows.map((r) => ({
      id: String(r._id),
      slug: r.problemSlug,
      title: r.problemTitle || titles.get(r.problemSlug) || r.problemSlug,
      url: leetcodeUrl(r.problemSlug),
      result: r.result,
      createdAt: r.createdAt,
      localDate: r.localDate || istDate(new Date(r.createdAt)),
      localTime: r.localTime || istTime(new Date(r.createdAt)),
    }));

    return NextResponse.json({
      ok: true,
      today,
      stats: {
        trackedQuestions,
        attemptedToday: todaySlugs.length,
        totalAttempts,
        solved: n('solved'),
        hint: n('hint'),
        failed: n('failed'),
        attemptedOnly: n('attempted'),
      },
      dailyProgress,
      recent,
    });
  } catch (e) {
    return fail(e, 'stats GET');
  }
}
