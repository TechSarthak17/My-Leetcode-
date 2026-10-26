/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { bad, fail } from '@/lib/api';
import { USER_ID } from '@/lib/user';
import { istDate, istDayRange, istTime, TZ } from '@/lib/time';
import { leetcodeUrl } from '@/lib/leetcode';
import { titleMap } from '@/lib/revision';
import Attempt from '@/models/Attempt';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RESULT_FILTERS = ['solved', 'hint', 'failed', 'attempted'];

/** GET /api/history?q=&result=&date=YYYY-MM-DD&limit=&skip=  — newest first, straight from MongoDB. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const result = sp.get('result') ?? '';
  const date = sp.get('date') ?? '';
  const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 1000);
  const skip = Math.max(parseInt(sp.get('skip') ?? '0', 10) || 0, 0);
  if (result && !RESULT_FILTERS.includes(result)) return bad('Invalid result filter.');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('date must be YYYY-MM-DD.');

  const match: Record<string, any> = { userId: USER_ID };
  if (result) match.result = result;
  if (date) {
    const { start, end } = istDayRange(date);
    match.createdAt = { $gte: start, $lt: end };
  }
  if (q) {
    const text = new RegExp(escapeRegex(q), 'i');
    const slugLike = new RegExp(escapeRegex(q).replace(/\s+/g, '-'), 'i');
    match.$or = [{ problemTitle: text }, { problemSlug: text }, { problemSlug: slugLike }];
  }

  try {
    await connectDB();
    const summaryMatch: Record<string, any> = { userId: USER_ID };
    if (date) summaryMatch.createdAt = match.createdAt;

    const [rows, total, summaries]: [any[], number, any[]] = await Promise.all([
      Attempt.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Attempt.countDocuments(match),
      Attempt.aggregate([
        { $match: summaryMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
            attempts: { $sum: 1 },
            solved: { $sum: { $cond: [{ $eq: ['$result', 'solved'] }, 1, 0] } },
            hint: { $sum: { $cond: [{ $eq: ['$result', 'hint'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$result', 'failed'] }, 1, 0] } },
            questions: { $addToSet: '$problemSlug' },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 60 },
      ]),
    ]);

    const slugs = [...new Set(rows.map((r) => r.problemSlug as string))];
    const [titles, counts]: [Map<string, string>, any[]] = await Promise.all([
      titleMap(slugs),
      slugs.length ? Attempt.aggregate([{ $match: { userId: USER_ID, problemSlug: { $in: slugs } } }, { $group: { _id: '$problemSlug', n: { $sum: 1 } } }]) : Promise.resolve([]),
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.n]));

    const attempts = rows.map((r) => ({
      id: String(r._id),
      slug: r.problemSlug,
      title: r.problemTitle || titles.get(r.problemSlug) || r.problemSlug,
      url: leetcodeUrl(r.problemSlug),
      result: r.result,
      createdAt: r.createdAt,
      localDate: r.localDate || istDate(new Date(r.createdAt)),
      localTime: r.localTime || istTime(new Date(r.createdAt)),
      sessionType: r.sessionType ?? 'practice',
      notes: r.notes ?? '',
      totalAttemptsForQuestion: countMap.get(r.problemSlug) ?? 1,
    }));
    const dailySummaries = summaries.map((s) => ({
      date: s._id,
      questionsAttempted: s.questions.length,
      attempts: s.attempts,
      solved: s.solved,
      hint: s.hint,
      failed: s.failed,
    }));
    return NextResponse.json({ ok: true, attempts, total, hasMore: skip + rows.length < total, dailySummaries });
  } catch (e) {
    return fail(e, 'history GET');
  }
}
