'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Code2, ExternalLink, History, Lightbulb, Loader2, Shuffle, XCircle } from 'lucide-react';

type ResultKind = 'solved' | 'hint' | 'failed';
type Question = {
  slug: string; title: string; difficulty: string; topic: string; tags: string[]; number: number | null; url: string; hasEditor: boolean;
  attempt: { id: string; result: ResultKind; at: string; notes: string } | null;
};
type Session = { sessionId: string; type: 'daily' | 'extra'; localDate: string; status: 'active' | 'completed'; total: number; answered: number; currentIndex: number; questions: Question[] };

const RESULT_UI: Record<ResultKind, { label: string; saved: string; cls: string; chip: string; icon: typeof CheckCircle2 }> = {
  solved: { label: 'Solved Independently', saved: 'Solved independently', cls: 'bg-emerald-500 text-black hover:bg-emerald-400', chip: 'border-emerald-400/30 text-emerald-300', icon: CheckCircle2 },
  hint: { label: 'Needed a Hint', saved: 'Needed a hint', cls: 'bg-amber-400 text-black hover:bg-amber-300', chip: 'border-amber-300/30 text-amber-200', icon: Lightbulb },
  failed: { label: 'Could Not Solve', saved: 'Could not solve', cls: 'bg-rose-500 text-white hover:bg-rose-400', chip: 'border-rose-400/30 text-rose-300', icon: XCircle },
};
const diffColor = (d: string) => (d === 'Easy' ? 'text-emerald-300' : d === 'Medium' ? 'text-amber-200' : d === 'Hard' ? 'text-rose-300' : 'text-slate-400');

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4 sm:p-6 md:p-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={17} /> Dashboard</Link>
        <Link href="/history" className="flex items-center gap-2 text-sm text-violet-200 hover:text-white"><History size={16} /> Attempt history</Link>
      </div>
      <div className="mt-6 sm:mt-9">{children}</div>
    </main>
  );
}

export default function TestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exhausted, setExhausted] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; result: ResultKind } | null>(null);
  const [notes, setNotes] = useState('');
  const busy = useRef(false); // synchronous guard against double-clicks

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/revision/session', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load your session.');
      setSession(d.session);
      setPoolSize(d.poolSize ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your session.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(type: 'daily' | 'extra', reshuffle = false) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setExhausted(false);
    try {
      const r = await fetch('/api/revision/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, reshuffle }) });
      const d = await r.json();
      if (r.status === 409 && d.poolExhausted) { setExhausted(true); setPoolSize(d.poolSize ?? poolSize); return; }
      if (!r.ok) throw new Error(d.error || 'Could not start a session.');
      setSession(d.session); setPoolSize(d.poolSize ?? poolSize); setConfirmation(null); setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session.');
    } finally {
      busy.current = false; setSaving(false);
    }
  }

  async function record(result: ResultKind) {
    if (busy.current || !session) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const r = await fetch('/api/revision/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.sessionId, slug: q.slug, result, notes }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'The result was not saved. Please try again.');
      // Only now — after the server confirmed the write — do we show success.
      setSession(d.session);
      setConfirmation({ title: q.title, result: d.attempt.result });
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The result was not saved. Please try again.');
    } finally {
      busy.current = false; setSaving(false);
    }
  }

  const errorBox = error ? <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null;

  if (loading) return <Shell><p className="text-sm text-slate-400">Loading your revision session…</p></Shell>;

  // ----- no session yet today -----
  if (!session) {
    return (
      <Shell>
        {errorBox}
        <section className="rounded-2xl border border-violet-300/20 bg-violet-400/[.06] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-violet-200"><Shuffle /><span className="text-sm font-semibold uppercase tracking-wider">Daily revision</span></div>
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Two random questions from your saved bank.</h1>
          {poolSize === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">You have not saved any solved questions yet. <Link href="/" className="text-violet-200 underline underline-offset-4">Add a question from the dashboard</Link> and come back.</p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-400">{poolSize} saved question{poolSize === 1 ? '' : 's'} in your pool.{poolSize < 2 ? ' You only have one saved question, so today\'s set will contain just that one — add more for a full set of two.' : ''} Questions are shown one at a time. Nothing is recorded until you pick a result.</p>
              <button onClick={() => start('daily')} disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold hover:bg-violet-400 disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}Start today&apos;s revision</button>
            </>
          )}
        </section>
      </Shell>
    );
  }

  const label = session.type === 'daily' ? 'Daily revision' : 'Extra practice';
  const progress = (
    <div className="mb-5">
      <div className="flex items-center justify-between text-xs text-slate-400"><span className="uppercase tracking-wider text-violet-200">{label}</span><span>{session.answered} of {session.total} answered</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-violet-400 transition-all" style={{ width: `${(session.answered / Math.max(session.total, 1)) * 100}%` }} /></div>
    </div>
  );

  // ----- server-confirmed save, shown until the user advances -----
  if (confirmation) {
    const ui = RESULT_UI[confirmation.result];
    const last = session.status === 'completed';
    return (
      <Shell>
        {progress}
        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-6 sm:p-8" role="status">
          <ui.icon className="text-violet-300" />
          <h2 className="mt-4 text-xl font-bold">Saved: {ui.saved}</h2>
          <p className="mt-1 text-sm text-slate-400">{confirmation.title} — stored in your attempt history.</p>
          <button onClick={() => setConfirmation(null)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold hover:bg-violet-400">
            <Shuffle size={16} />{last ? 'See summary' : 'Next Random Question'}
          </button>
        </section>
      </Shell>
    );
  }

  // ----- completion screen -----
  if (session.status === 'completed') {
    const count = (k: ResultKind) => session.questions.filter((q) => q.attempt?.result === k).length;
    return (
      <Shell>
        {errorBox}
        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[.05] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-200">{label} complete</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{session.total === 1 ? 'You finished your question.' : `You finished all ${session.total} questions.`}</h1>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {(['solved', 'hint', 'failed'] as ResultKind[]).map((k) => (
              <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-2xl font-bold">{count(k)}</p><p className="text-xs text-slate-400">{RESULT_UI[k].saved}</p></div>
            ))}
          </div>
          <ul className="mt-5 space-y-2">
            {session.questions.map((q) => (
              <li key={q.slug} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">{q.title}</span>
                {q.attempt && <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${RESULT_UI[q.attempt.result].chip}`}>{RESULT_UI[q.attempt.result].saved}</span>}
              </li>
            ))}
          </ul>
          {poolSize < 2 && <p className="mt-4 text-sm text-amber-200">You only have {poolSize} saved question{poolSize === 1 ? '' : 's'}. Add more from the dashboard for a fuller revision set.</p>}
          {exhausted && (
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              You have now seen every one of your {poolSize} saved questions today, so the unseen pool is exhausted. You can reshuffle to draw from the full pool again (repeats are possible).
              <button onClick={() => start('extra', true)} disabled={saving} className="mt-3 block rounded-lg bg-amber-300 px-4 py-2 font-semibold text-black disabled:opacity-50">Reshuffle and continue</button>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => start('extra')} disabled={saving || poolSize === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold hover:bg-violet-400 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}Practice 2 More Random Questions</button>
            <Link href="/history" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5"><History size={16} />View Attempt History</Link>
          </div>
        </section>
      </Shell>
    );
  }

  // ----- one question at a time -----
  const q = session.questions[session.currentIndex];
  return (
    <Shell>
      {progress}
      {errorBox}
      <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">Question {session.currentIndex + 1} of {session.total}</p>
        <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{q.number ? `${q.number}. ` : ''}{q.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`font-semibold ${diffColor(q.difficulty)}`}>{q.difficulty}</span>
          {q.tags.slice(0, 6).map((t) => <span key={t} className="rounded-lg bg-violet-400/10 px-2.5 py-1 text-violet-200">{t}</span>)}
          {!q.tags.length && q.topic && <span className="rounded-lg bg-violet-400/10 px-2.5 py-1 text-violet-200">{q.topic}</span>}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={q.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/30 px-4 py-3 text-sm text-violet-100 hover:bg-violet-400/10"><ExternalLink size={16} />Open on LeetCode</a>
          {q.hasEditor && <Link href={`/practice/${q.slug}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/5"><Code2 size={16} />Open Python Editor</Link>}
        </div>
        <p className="mt-3 text-xs text-slate-500">Opening a link does not record anything. Attempt the problem, then choose the honest result below.</p>

        <label htmlFor="notes" className="mt-7 block text-xs text-slate-400">Notes (optional)</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="What tripped you up? Key idea, complexity…" className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-violet-300/40" />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(['solved', 'hint', 'failed'] as ResultKind[]).map((k) => (
            <button key={k} onClick={() => record(k)} disabled={saving} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${RESULT_UI[k].cls}`}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}{RESULT_UI[k].label}
            </button>
          ))}
        </div>
        {saving && <p className="mt-3 text-center text-xs text-slate-400" role="status">Saving…</p>}
      </section>
    </Shell>
  );
}
