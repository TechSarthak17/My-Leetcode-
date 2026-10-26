/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { bad, fail, isDuplicateKey } from '@/lib/api';
import { USER_ID } from '@/lib/user';
import { initModels } from '@/lib/revision';
import { problems } from '@/lib/problems';
import { asDifficulty, fetchByNumber, fetchBySlug, leetcodeUrl, Meta, normalizeSlug, parseInput } from '@/lib/leetcode';
import TrackedProblem from '@/models/TrackedProblem';
import Attempt from '@/models/Attempt';

const shape = (t: any, stats?: any) => ({
  slug: t.slug,
  title: t.title,
  number: t.questionNumber ?? null,
  difficulty: t.difficulty ?? 'Unknown',
  topic: t.topic ?? '',
  tags: t.tags ?? [],
  url: t.url || leetcodeUrl(t.slug),
  source: t.source ?? 'import',
  dateAdded: t.createdAt ?? t.solvedAt ?? null,
  attempts: stats?.attempts ?? 0,
  lastResult: stats?.lastResult ?? null,
  lastAttemptAt: stats?.lastAttemptAt ?? null,
  hasEditor: problems.some((p) => p.slug === t.slug),
});

/** The tracked question library (manual + imported + synced) with real attempt counts. */
export async function GET() {
  try {
    await connectDB();
    const [tracked, agg]: [any[], any[]] = await Promise.all([
      TrackedProblem.find({ userId: USER_ID }).sort({ createdAt: -1 }).lean(),
      Attempt.aggregate([
        { $match: { userId: USER_ID } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: '$problemSlug', attempts: { $sum: 1 }, lastResult: { $last: '$result' }, lastAttemptAt: { $last: '$createdAt' } } },
      ]),
    ]);
    const stats = new Map(agg.map((a) => [a._id, a]));
    const trackedSlugs = new Set(tracked.map((t) => t.slug));
    // Built-in demo questions: shown separately and never counted as tracked/solved.
    const samples = problems
      .filter((p) => !trackedSlugs.has(p.slug))
      .map((p) => ({ slug: p.slug, title: p.title, difficulty: p.difficulty, topic: p.topic, attempts: stats.get(p.slug)?.attempts ?? 0 }));
    return NextResponse.json({ ok: true, questions: tracked.map((t) => shape(t, stats.get(t.slug))), samples });
  } catch (e) {
    return fail(e, 'questions GET');
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Add a question by LeetCode number, URL or slug. If metadata cannot be resolved automatically the
 * response is 422 {needsManual:true}; the client then resubmits with an explicit slug + title.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return bad('Invalid request body.');
  const input = str(body.input, 300);
  const manualTitle = str(body.title, 200);
  const manualSlug = body.slug ? normalizeSlug(str(body.slug, 120)) : '';
  if (!input && !manualSlug) return bad('Enter a LeetCode question number or URL.');

  const parsed = input ? parseInput(input) : null;
  if (input && !parsed) return bad('Could not understand that. Enter a question number (e.g. 1), a leetcode.com/problems/... URL, or a slug.');

  let slug = manualSlug || (parsed?.kind === 'slug' ? parsed.slug : '');
  const number: number | null = parsed?.kind === 'number' ? parsed.number : Number.isInteger(body.number) && body.number > 0 ? body.number : null;

  try {
    await connectDB();
    await initModels();

    // Duplicate check before any network call.
    let dup: any = slug ? await TrackedProblem.findOne({ userId: USER_ID, slug }).lean() : null;
    if (!dup && number) dup = await TrackedProblem.findOne({ userId: USER_ID, questionNumber: number }).lean();
    if (dup) return bad(`"${dup.title}" is already in your tracked questions.`, 409, { duplicate: true, question: shape(dup) });

    let meta: Meta | null = null;
    if (manualTitle && slug) {
      meta = { number, slug, title: manualTitle, difficulty: asDifficulty(body.difficulty), tags: [] };
    } else {
      try {
        meta = parsed?.kind === 'number' ? await fetchByNumber(parsed.number) : slug ? await fetchBySlug(slug) : null;
      } catch (e) {
        console.error('[DSARecall metadata lookup]', e);
      }
    }
    if (!meta) {
      return bad(
        parsed?.kind === 'number'
          ? `Could not look up problem #${parsed.number} automatically. Paste its LeetCode URL or slug, or enter the title yourself.`
          : 'Could not fetch details for that problem automatically. Enter the title (and optionally difficulty) yourself.',
        422,
        { needsManual: true, slug, number },
      );
    }

    slug = meta.slug;
    const finalNumber = meta.number ?? number;
    const again: any = await TrackedProblem.findOne({ userId: USER_ID, $or: [{ slug }, ...(finalNumber ? [{ questionNumber: finalNumber }] : [])] }).lean();
    if (again) return bad(`"${again.title}" is already in your tracked questions.`, 409, { duplicate: true, question: shape(again) });

    const doc = await TrackedProblem.create({
      userId: USER_ID,
      slug,
      title: meta.title,
      questionNumber: finalNumber ?? undefined,
      difficulty: meta.difficulty,
      topic: str(body.topic, 100) || meta.tags.slice(0, 2).join(' / ') || 'Uncategorised',
      tags: meta.tags,
      url: leetcodeUrl(slug),
      source: 'manual',
    });
    return NextResponse.json({ ok: true, question: shape(doc.toObject()) }, { status: 201 });
  } catch (e) {
    if (isDuplicateKey(e)) return bad('That question is already in your tracked questions.', 409, { duplicate: true });
    return fail(e, 'questions POST');
  }
}
