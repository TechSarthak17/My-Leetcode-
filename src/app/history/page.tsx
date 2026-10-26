'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Search } from 'lucide-react';

type Attempt = { id: string; slug: string; title: string; url: string; result: string; createdAt: string; localDate: string; localTime: string; sessionType: string; notes: string; totalAttemptsForQuestion: number };
type Summary = { date: string; questionsAttempted: number; attempts: number; solved: number; hint: number; failed: number };

const RESULT: Record<string, { label: string; cls: string }> = {
  solved: { label: 'Solved independently', cls: 'border-emerald-400/30 text-emerald-300' },
  hint: { label: 'Needed a hint', cls: 'border-amber-300/30 text-amber-200' },
  failed: { label: 'Could not solve', cls: 'border-rose-400/30 text-rose-300' },
  attempted: { label: 'Saved from editor', cls: 'border-slate-400/30 text-slate-300' },
};
const SESSION: Record<string, string> = { daily: 'Daily set', extra: 'Extra practice', practice: 'Python editor' };
const PAGE = 50;

export default function HistoryPage() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState('');
  const [date, setDate] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (skip: number) => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ limit: String(PAGE), skip: String(skip) });
      if (q.trim()) p.set('q', q.trim());
      if (result) p.set('result', result);
      if (date) p.set('date', date);
      const r = await fetch(`/api/history?${p}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load history.');
      setAttempts((prev) => (skip ? [...prev, ...d.attempts] : d.attempts));
      setSummaries(d.dailySummaries); setTotal(d.total); setHasMore(d.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load history.');
    } finally {
      setLoading(false);
    }
  }, [q, result, date]);

  useEffect(() => { const t = setTimeout(() => void load(0), 250); return () => clearTimeout(t); }, [load]);

  const fmtDate = (s: string) => new Date(`${s}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-4 sm:p-6 md:p-10">
      <Link href="/" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={17} /> Dashboard</Link>
      <h1 className="mt-6 text-3xl font-bold">Attempt history</h1>
      <p className="mt-2 text-sm text-slate-400">Every attempt is its own record, newest first. Times are shown in India time (Asia/Kolkata).</p>

      <section className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 px-3"><Search size={16} className="text-slate-400" /><input aria-label="Search by title or slug" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or slug…" className="w-full bg-transparent py-3 text-sm outline-none" /></div>
        <select aria-label="Filter by result" value={result} onChange={(e) => setResult(e.target.value)} className="rounded-xl border border-white/10 bg-[#11141c] px-3 py-3 text-sm outline-none">
          <option value="">All results</option><option value="solved">Solved independently</option><option value="hint">Needed a hint</option><option value="failed">Could not solve</option><option value="attempted">Saved from editor</option>
        </select>
        <input aria-label="Filter by date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-white/10 bg-[#11141c] px-3 py-3 text-sm outline-none" />
        <button onClick={() => { setQ(''); setResult(''); setDate(''); }} className="rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/5">Clear</button>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      <section className="mt-8">
        <h2 className="text-lg font-bold">{date ? 'Summary for the selected day' : 'Daily summary'}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.slice(0, date ? 1 : 9).map((s) => (
            <div key={s.date} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
              <p className="text-sm font-semibold">{fmtDate(s.date)}</p>
              <p className="mt-1 text-xs text-slate-400">{s.questionsAttempted} question{s.questionsAttempted === 1 ? '' : 's'} · {s.attempts} attempt{s.attempts === 1 ? '' : 's'}</p>
              <div className="mt-3 flex gap-2 text-xs"><span className="rounded-full border border-emerald-400/30 px-2 py-1 text-emerald-300">{s.solved} solved</span><span className="rounded-full border border-amber-300/30 px-2 py-1 text-amber-200">{s.hint} hint</span><span className="rounded-full border border-rose-400/30 px-2 py-1 text-rose-300">{s.failed} failed</span></div>
            </div>
          ))}
          {!summaries.length && !loading && <p className="text-sm text-slate-500">No attempts recorded{date ? ' on this day' : ' yet'}.</p>}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between"><h2 className="text-lg font-bold">Attempts</h2><span className="text-xs text-slate-400">{total} match{total === 1 ? '' : 'es'}</span></div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          {attempts.map((a, i) => (
            <div key={a.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${i ? 'border-t border-white/10' : ''}`}>
              <div className="min-w-0">
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold hover:text-violet-200">{a.title}<ExternalLink size={13} className="text-slate-500" /></a>
                <p className="mt-1 text-xs text-slate-400">{fmtDate(a.localDate)} · {a.localTime} · {SESSION[a.sessionType] ?? a.sessionType} · attempted {a.totalAttemptsForQuestion}× in total</p>
                {a.notes && <p className="mt-1 text-xs italic text-slate-500">“{a.notes}”</p>}
              </div>
              <span className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs ${(RESULT[a.result] ?? RESULT.attempted).cls}`}>{(RESULT[a.result] ?? RESULT.attempted).label}</span>
            </div>
          ))}
          {!attempts.length && <p className="p-8 text-center text-sm text-slate-400">{loading ? 'Loading…' : 'No attempts match these filters.'}</p>}
        </div>
        {hasMore && <button disabled={loading} onClick={() => load(attempts.length)} className="mt-4 rounded-xl border border-white/10 px-5 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50">{loading ? 'Loading…' : 'Load more'}</button>}
      </section>
    </main>
  );
}
