/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import TrackedProblem from '@/models/TrackedProblem';
import { USER_ID } from '@/lib/user';
import { asDifficulty, leetcodeUrl, normalizeSlug } from '@/lib/leetcode';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rows: any[] = Array.isArray(body.problems) ? body.problems : [];
  if (!rows.length || rows.length > 5000) return NextResponse.json({ error: 'Upload a JSON array or CSV with 1–5000 problem rows.' }, { status: 400 });
  try {
    await connectDB();
    let imported = 0;
    let skipped = 0;
    for (const x of rows) {
      const title = String(x.title || x.titleSlug || x.title_slug || x.name || '').trim();
      const slug = normalizeSlug(String(x.slug || x.titleSlug || x.title_slug || title));
      if (!title || !slug) { skipped++; continue; }
      const tags = Array.isArray(x.tags) ? x.tags.map(String) : [];
      const num = Number(x.number ?? x.questionNumber ?? x.id);
      // $setOnInsert: an existing (e.g. manually added) question is never overwritten by an import.
      const r = await TrackedProblem.updateOne(
        { userId: USER_ID, slug },
        {
          $setOnInsert: {
            title,
            difficulty: asDifficulty(x.difficulty),
            topic: String(x.topic || (tags.length ? tags.slice(0, 2).join(' / ') : '') || (typeof x.tags === 'string' ? x.tags : '') || 'Imported'),
            tags,
            url: leetcodeUrl(slug),
            source: 'file-import',
            solvedAt: x.solvedAt && !isNaN(new Date(x.solvedAt).getTime()) ? new Date(x.solvedAt) : new Date(),
            ...(Number.isInteger(num) && num > 0 ? { questionNumber: num } : {}),
          },
        },
        { upsert: true },
      );
      if (r.upsertedCount) imported++; else skipped++;
    }
    return NextResponse.json({ ok: true, imported, skipped });
  } catch (e) {
    console.error('[DSARecall import]', e);
    return NextResponse.json({ error: 'MongoDB unavailable or import failed. Check MONGODB_URI in .env.local.' }, { status: 503 });
  }
}
