/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { bad, fail, isDuplicateKey } from '@/lib/api';
import { USER_ID } from '@/lib/user';
import { istDate, istTime } from '@/lib/time';
import { buildView, initModels, RESULTS, ResultKind } from '@/lib/revision';
import Attempt from '@/models/Attempt';
import RevisionSession from '@/models/RevisionSession';
import TrackedProblem from '@/models/TrackedProblem';

/** Records one result as a NEW attempt document. Safe to call twice for the same question (idempotent). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const result = body?.result as ResultKind;
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';
  const t = body?.timeSpentSec;
  if (!sessionId || !slug) return bad('sessionId and slug are required.');
  if (!RESULTS.includes(result)) return bad("result must be 'solved', 'hint' or 'failed'.");
  if (t !== undefined && !(typeof t === 'number' && t >= 0 && t <= 86400)) return bad('timeSpentSec must be between 0 and 86400.');

  try {
    await connectDB();
    await initModels();
    const session: any = await RevisionSession.findOne({ userId: USER_ID, sessionId }).lean();
    if (!session) return bad('Revision session not found.', 404);
    if (!session.questionSlugs.includes(slug)) return bad('That question is not part of this session.', 400);

    let attempt: any = await Attempt.findOne({ userId: USER_ID, sessionId, problemSlug: slug }).lean();
    let duplicate = Boolean(attempt);

    if (!attempt) {
      const answered: string[] = (await Attempt.find({ userId: USER_ID, sessionId }).select('problemSlug').lean()).map((a: any) => a.problemSlug);
      const current = session.questionSlugs.find((s: string) => !answered.includes(s));
      if (slug !== current) return bad('That is not the current question of this session.', 409);
      const tracked: any = await TrackedProblem.findOne({ userId: USER_ID, slug }).select('title').lean();
      const now = new Date();
      try {
        const doc = await Attempt.create({
          userId: USER_ID,
          problemSlug: slug,
          problemTitle: tracked?.title ?? slug,
          result,
          sessionId,
          sessionType: session.type,
          localDate: istDate(now),
          localTime: istTime(now),
          notes,
          timeSpentSec: typeof t === 'number' ? Math.round(t) : undefined,
          testMode: true,
          createdAt: now,
        });
        attempt = doc.toObject();
      } catch (e) {
        if (!isDuplicateKey(e)) throw e;
        attempt = await Attempt.findOne({ userId: USER_ID, sessionId, problemSlug: slug }).lean(); // lost a double-click race
        duplicate = true;
      }
    }

    const view = await buildView(session);
    if (view.status === 'completed' && session.status !== 'completed') {
      await RevisionSession.updateOne({ _id: session._id }, { $set: { status: 'completed', completedAt: new Date() } });
    }
    return NextResponse.json({ ok: true, duplicate, attempt: { id: String(attempt._id), result: attempt.result, createdAt: attempt.createdAt }, session: view });
  } catch (e) {
    return fail(e, 'answer POST');
  }
}
