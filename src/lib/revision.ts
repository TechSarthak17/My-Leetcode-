/* eslint-disable @typescript-eslint/no-explicit-any */
import Attempt from '@/models/Attempt';
import RevisionSession from '@/models/RevisionSession';
import TrackedProblem from '@/models/TrackedProblem';
import { problems } from '@/lib/problems';
import { leetcodeUrl } from '@/lib/leetcode';
import { USER_ID } from '@/lib/user';

export const DAILY_SIZE = 2;
export type ResultKind = 'solved' | 'hint' | 'failed';
export const RESULTS: ResultKind[] = ['solved', 'hint', 'failed'];

/** Make sure unique/partial indexes exist before relying on them for duplicate protection. */
export async function initModels() {
  await Promise.all([Attempt.init(), RevisionSession.init(), TrackedProblem.init()]);
}

export async function titleMap(slugs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>(problems.map((p) => [p.slug, p.title]));
  if (slugs.length) {
    const tracked: any[] = await TrackedProblem.find({ userId: USER_ID, slug: { $in: slugs } }).select('slug title').lean();
    for (const t of tracked) map.set(t.slug, t.title);
  }
  return map;
}

/** Hydrates a stored session with question details and the attempts recorded for it. */
export async function buildView(session: any) {
  const slugs: string[] = session.questionSlugs;
  const [tracked, attempts]: [any[], any[]] = await Promise.all([
    TrackedProblem.find({ userId: USER_ID, slug: { $in: slugs } }).lean(),
    Attempt.find({ userId: USER_ID, sessionId: session.sessionId }).lean(),
  ]);
  const tMap = new Map(tracked.map((t) => [t.slug, t]));
  const aMap = new Map(attempts.map((a) => [a.problemSlug, a]));
  const editorSlugs = new Set(problems.map((p) => p.slug));
  const questions = slugs.map((slug) => {
    const t = tMap.get(slug);
    const a = aMap.get(slug);
    return {
      slug,
      title: t?.title ?? slug,
      difficulty: t?.difficulty ?? 'Unknown',
      topic: t?.topic ?? '',
      tags: (t?.tags ?? []) as string[],
      number: t?.questionNumber ?? null,
      url: leetcodeUrl(slug),
      hasEditor: editorSlugs.has(slug),
      attempt: a ? { id: String(a._id), result: a.result as ResultKind, at: a.createdAt as Date, notes: (a.notes ?? '') as string } : null,
    };
  });
  const answered = questions.filter((q) => q.attempt).length;
  return {
    sessionId: session.sessionId as string,
    type: session.type as 'daily' | 'extra',
    localDate: session.localDate as string,
    status: (answered >= questions.length ? 'completed' : 'active') as 'active' | 'completed',
    total: questions.length,
    answered,
    currentIndex: questions.findIndex((q) => !q.attempt),
    questions,
  };
}
