
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import TrackedProblem from "@/models/TrackedProblem";
import DailyRevision from "@/models/DailyRevision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_ID = "local-user";

function getDateKey() {
  // Date key uses UTC so it remains consistent across requests.
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    await connectDB();

    const dateKey = getDateKey();

    type DailyRevisionData = {
  problemSlugs: string[];
  results: {
    slug: string;
    status: "solved" | "hint" | "failed";
    recordedAt?: Date;
  }[];
};

    let daily = (await DailyRevision.findOne({
  userId: USER_ID,
  dateKey,
}).lean()) as DailyRevisionData | null;

    if (!daily) {
      const saved = await TrackedProblem.find({
        userId: USER_ID,
      })
        .select("slug title difficulty topic source")
        .lean();

      // Fisher–Yates shuffle: unbiased random ordering.
      const pool = [...saved];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const problemSlugs = pool.slice(0, 2).map((p) => p.slug);

      try {
        daily = (await DailyRevision.findOneAndUpdate(
  { userId: USER_ID, dateKey },
  {
    $setOnInsert: {
      userId: USER_ID,
      dateKey,
      problemSlugs,
      results: [],
    },
  },
  { upsert: true, new: true }
).lean()) as DailyRevisionData | null;
      } catch {
        // Another simultaneous request may have created today's set.
        daily = (await DailyRevision.findOne({
  userId: USER_ID,
  dateKey,
}).lean()) as DailyRevisionData | null;
      }
    }

    const slugs = daily?.problemSlugs ?? [];
    const problems = await TrackedProblem.find({
      userId: USER_ID,
      slug: { $in: slugs },
    })
      .select("slug title difficulty topic source")
      .lean();

    const ordered = slugs
      .map((slug: string) =>
        problems.find((p) => p.slug === slug)
      )
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      dateKey,
      count: ordered.length,
      problems: ordered,
      results: daily?.results ?? [],
      message:
        ordered.length < 2
          ? `Only ${ordered.length} saved question(s) available. Add more solved questions for a full 2-question test.`
          : undefined,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not load today's revision. Check MongoDB." },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    const status = String(body.status ?? "");

    if (!slug || !["solved", "hint", "failed"].includes(status)) {
      return NextResponse.json(
        { error: "Provide a valid question and result." },
        { status: 400 }
      );
    }

    await connectDB();

    const dateKey = getDateKey();
    const daily = await DailyRevision.findOne({
      userId: USER_ID,
      dateKey,
    });

    if (!daily || !daily.problemSlugs.includes(slug)) {
      return NextResponse.json(
        { error: "Question is not part of today's revision." },
        { status: 404 }
      );
    }

    daily.results = daily.results.filter(
      (r: { slug: string }) => r.slug !== slug
    );

    daily.results.push({ slug, status, recordedAt: new Date() });
    await daily.save();

    return NextResponse.json({ ok: true, results: daily.results });
  } catch {
    return NextResponse.json(
      { error: "Could not save the result." },
      { status: 503 }
    );
  }
}
