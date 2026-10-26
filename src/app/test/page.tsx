
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";

type Problem = {
  slug: string;
  title: string;
  difficulty: string;
  topic?: string;
};

type Result = {
  slug: string;
  status: string;
};

export default function TestPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateKey, setDateKey] = useState("");

  async function loadToday() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/revision/today", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load revision.");
      }

      setProblems(data.problems || []);
      setDateKey(data.dateKey || "");

      const saved: Record<string, string> = {};
      (data.results as Result[] || []).forEach((r) => {
        saved[r.slug] = r.status;
      });
      setResults(saved);
      if (data.message) setError(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadToday();
  }, []);

  async function saveResult(slug: string, status: string) {
    setError("");

    try {
      const response = await fetch("/api/revision/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, status }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save result.");
      }

      setResults((previous) => ({ ...previous, [slug]: status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save result.");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-5 md:p-10">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-slate-300"
      >
        <ArrowLeft size={17} /> Dashboard
      </Link>

      <section className="mt-8 rounded-2xl border border-violet-300/20 bg-violet-400/[.06] p-6">
        <p className="text-sm font-semibold text-violet-200">
          DAILY RANDOM REVISION
        </p>
        <h1 className="mt-3 text-3xl font-bold">Your 2-question recall test</h1>
        <p className="mt-2 text-sm text-slate-400">
          {dateKey ? `Revision date: ${dateKey}` : "Loading today's test..."}
          {" "}Solve from memory before checking hints or solutions.
        </p>

        <button
          onClick={loadToday}
          disabled={loading}
          className="mt-5 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh today's test
        </button>
      </section>

      {error && (
        <p className="mt-5 rounded-xl border border-amber-300/20 p-4 text-sm text-amber-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">Loading your saved questions...</p>
      ) : problems.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-white/10 p-6">
          <h2 className="font-semibold">No saved questions yet</h2>
          <p className="mt-2 text-sm text-slate-400">
            First add solved LeetCode questions to your tracked questions.
            The daily test only uses that saved list, not demo questions.
          </p>
          <Link href="/" className="mt-4 inline-block text-violet-200 underline">
            Return to dashboard
          </Link>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {problems.map((p, index) => (
            <article
              key={p.slug}
              className="rounded-2xl border border-white/10 p-5"
            >
              <p className="text-xs text-violet-200">
                Question {index + 1} · {p.difficulty}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {p.topic || "Saved LeetCode problem"}
              </p>

              <a
                href={`https://leetcode.com/problems/${p.slug}/`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-violet-200 underline"
              >
                Open on LeetCode <ExternalLink size={15} />
              </a>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">How did you do?</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["solved", "Solved independently"],
                    ["hint", "Needed a hint"],
                    ["failed", "Could not solve"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => saveResult(p.slug, value)}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        results[p.slug] === value
                          ? "border-violet-300 bg-violet-500/20 text-violet-100"
                          : "border-white/10 text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {results[p.slug] && (
                  <p className="mt-2 text-xs text-emerald-300">
                    Result saved to today's revision.
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
