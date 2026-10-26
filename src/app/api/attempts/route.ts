import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attempt from '@/models/Attempt';
import { problems } from '@/lib/problems';
import { USER_ID } from '@/lib/user';
import { istDate, istTime } from '@/lib/time';

// Used by the Python practice editor ("Save attempt" / "Mark solved"). Revision results go through /api/revision/answer.
export async function GET() {
  try {
    await connectDB();
    const attempts = await Attempt.find({ userId: USER_ID }).sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json({ attempts });
  } catch {
    return NextResponse.json({ attempts: [], warning: 'Database is not configured; attempts cannot persist yet.' });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const problem = problems.find((p) => p.slug === body?.problemSlug);
  if (!problem || typeof body?.code !== 'string' || body.code.length > 50000) {
    return NextResponse.json({ error: 'Invalid attempt data.' }, { status: 400 });
  }
  try {
    await connectDB();
    const now = new Date();
    const attempt = await Attempt.create({
      userId: USER_ID,
      problemSlug: problem.slug,
      problemTitle: problem.title,
      code: body.code,
      language: 'python',
      result: body.result === 'solved' ? 'solved' : 'attempted',
      sessionType: 'practice',
      localDate: istDate(now),
      localTime: istTime(now),
      testMode: Boolean(body.testMode),
      createdAt: now,
    });
    return NextResponse.json({ ok: true, attempt });
  } catch {
    return NextResponse.json({ error: 'Database unavailable. Configure MONGODB_URI in .env.local to save progress.' }, { status: 503 });
  }
}
