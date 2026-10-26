/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { connectDB } from '@/lib/db';
import { bad, fail, isDuplicateKey } from '@/lib/api';
import { USER_ID } from '@/lib/user';
import { istDate } from '@/lib/time';
import { pickRandom } from '@/lib/random';
import { buildView, DAILY_SIZE, initModels } from '@/lib/revision';
import TrackedProblem from '@/models/TrackedProblem';
import RevisionSession from '@/models/RevisionSession';

/** Restores today's (India date) session, preferring one that is still in progress. Never creates anything. */
export async function GET() {
  try {
    await connectDB();
    const today = istDate();
    const [sessions, poolSize]: [any[], number] = await Promise.all([
      RevisionSession.find({ userId: USER_ID, localDate: today }).sort({ createdAt: -1 }).lean(),
      TrackedProblem.countDocuments({ userId: USER_ID }),
    ]);
    if (!sessions.length) return NextResponse.json({ ok: true, session: null, poolSize, localDate: today });
    const views = await Promise.all(sessions.map(buildView));
    const session = views.find((v) => v.status === 'active') ?? views[0];
    return NextResponse.json({ ok: true, session, poolSize, localDate: today });
  } catch (e) {
    return fail(e, 'session GET');
  }
}

/**
 * type 'daily': returns today's daily session, creating it with up to 2 random tracked questions on first call.
 * type 'extra': returns the unfinished session if one exists; otherwise creates a new random session that avoids
 *               every question already shown today. If none remain -> 409 {poolExhausted:true};
 *               resend with {reshuffle:true} to draw from the whole pool again.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = body?.type === 'daily' || body?.type === 'extra' ? (body.type as 'daily' | 'extra') : null;
  if (!type) return bad("type must be 'daily' or 'extra'.");
  const reshuffle = body?.reshuffle === true;

  try {
    await connectDB();
    await initModels();
    const pool: string[] = (await TrackedProblem.find({ userId: USER_ID }).select('slug').lean()).map((t: any) => t.slug);
    if (!pool.length) return bad('You have no tracked questions yet. Add a solved question from the dashboard first.', 409, { reason: 'no-questions', poolSize: 0 });
    const today = istDate();

    if (type === 'daily') {
      const existing: any = await RevisionSession.findOne({ userId: USER_ID, localDate: today, type: 'daily' }).lean();
      if (existing) {
        // If the daily set was short because the bank was tiny, top it up once more questions exist.
        if (existing.questionSlugs.length < DAILY_SIZE) {
          const more = pickRandom(pool.filter((s) => !existing.questionSlugs.includes(s)), DAILY_SIZE - existing.questionSlugs.length);
          if (more.length) {
            await RevisionSession.updateOne({ _id: existing._id }, { $push: { questionSlugs: { $each: more } }, $set: { status: 'active' }, $unset: { completedAt: '' } });
            existing.questionSlugs.push(...more);
          }
        }
        return NextResponse.json({ ok: true, created: false, poolSize: pool.length, session: await buildView(existing) });
      }
      try {
        const doc = await RevisionSession.create({ userId: USER_ID, sessionId: randomUUID(), type: 'daily', localDate: today, questionSlugs: pickRandom(pool, DAILY_SIZE) });
        return NextResponse.json({ ok: true, created: true, poolSize: pool.length, session: await buildView(doc.toObject()) }, { status: 201 });
      } catch (e) {
        if (!isDuplicateKey(e)) throw e;
        const raced: any = await RevisionSession.findOne({ userId: USER_ID, localDate: today, type: 'daily' }).lean();
        return NextResponse.json({ ok: true, created: false, poolSize: pool.length, session: await buildView(raced) });
      }
    }

    // extra practice
    const todays: any[] = await RevisionSession.find({ userId: USER_ID, localDate: today }).sort({ createdAt: -1 }).lean();
    for (const s of todays) {
      const view = await buildView(s);
      if (view.status === 'active') return NextResponse.json({ ok: true, created: false, poolSize: pool.length, session: view });
    }
    const shown = new Set(todays.flatMap((s) => s.questionSlugs as string[]));
    let candidates = pool.filter((s) => !shown.has(s));
    if (!candidates.length) {
      if (!reshuffle) {
        return bad('You have already seen every tracked question today. Reshuffle to start drawing from the full pool again.', 409, { poolExhausted: true, poolSize: pool.length });
      }
      const last = new Set<string>(todays[0]?.questionSlugs ?? []);
      candidates = pool.filter((s) => !last.has(s));
      if (!candidates.length) candidates = pool; // pool is no larger than the last session
    }
    const doc = await RevisionSession.create({ userId: USER_ID, sessionId: randomUUID(), type: 'extra', localDate: today, questionSlugs: pickRandom(candidates, DAILY_SIZE) });
    return NextResponse.json({ ok: true, created: true, poolSize: pool.length, session: await buildView(doc.toObject()) }, { status: 201 });
  } catch (e) {
    return fail(e, 'session POST');
  }
}
