/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, Brain, CheckCircle2, Code2, FileDown, History, Lightbulb, Plus, RefreshCw, Search, Target, Upload, XCircle } from 'lucide-react';

type Question = { slug: string; title: string; number: number | null; difficulty: string; topic: string; tags: string[]; url: string; source: string; dateAdded: string | null; attempts: number; lastResult: string | null; hasEditor: boolean };
type Sample = { slug: string; title: string; difficulty: string; topic: string; attempts: number };
type Stats = { trackedQuestions: number; attemptedToday: number; totalAttempts: number; solved: number; hint: number; failed: number; attemptedOnly: number };
type Recent = { id: string; slug: string; title: string; url: string; result: string; localDate: string; localTime: string };
type Progress = { exists: boolean; answered: number; total: number; status: string };

const RESULT_LABEL: Record<string, string> = { solved: 'Solved independently', hint: 'Needed a hint', failed: 'Could not solve', attempted: 'Saved from editor' };
const RESULT_COLOR: Record<string, string> = { solved: 'text-emerald-300', hint: 'text-amber-200', failed: 'text-rose-300', attempted: 'text-slate-300' };
const diffColor = (d: string) => (d === 'Easy' ? 'text-emerald-300' : d === 'Medium' ? 'text-amber-200' : d === 'Hard' ? 'text-rose-300' : 'text-slate-400');
const SOURCE: Record<string, string> = { manual: 'manual entry', 'public-sync': 'public sync', 'leetcode-public-api': 'public sync', 'file-import': 'file import', import: 'import' };

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress>({ exists: false, answered: 0, total: 0, status: 'none' });
  const [recent, setRecent] = useState<Recent[]>([]);
  const [diag, setDiag] = useState<any>(null);
  const [db, setDb] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loadError, setLoadError] = useState('');

  const [addInput, setAddInput] = useState('');
  const [manual, setManual] = useState<{ slug: string; title: string; difficulty: string } | null>(null);
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const [username, setUsername] = useState('TechSarthak17');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [qr, sr, dr] = await Promise.all([
        fetch('/api/questions', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/stats', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/diagnostics', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (!qr.ok || !sr.ok) throw new Error(qr.error || sr.error || 'Could not load data.');
      setQuestions(qr.questions); setSamples(qr.samples); setStats(sr.stats); setProgress(sr.dailyProgress); setRecent(sr.recent); setDiag(dr); setDb(true); setLoadError('');
    } catch (e) {
      setDb(false);
      setLoadError(e instanceof Error ? e.message : 'Could not load data. Is the dev server running and MONGODB_URI set?');
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function submitAdd(body: Record<string, unknown>) {
    setAdding(true); setAddMsg(null);
    try {
      const r = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        const q = d.question as Question;
        setAddMsg({ ok: true, text: `Added “${q.title}”${q.number ? ` (#${q.number})` : ''} · ${q.difficulty}.` });
        setAddInput(''); setManual(null); await refresh();
      } else if (r.status === 422 && d.needsManual) {
        setManual({ slug: d.slug || '', title: '', difficulty: 'Unknown' });
        setAddMsg({ ok: false, text: d.error });
      } else {
        setAddMsg({ ok: false, text: d.error || 'Could not add that question.' });
      }
    } catch {
      setAddMsg({ ok: false, text: 'Network error. Is the dev server running?' });
    } finally {
      setAdding(false);
    }
  }

  async function sync() {
    setBusy(true); setNotice('Checking public LeetCode submissions…');
    try {
      const r = await fetch('/api/leetcode-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      const d = await r.json();
      setNotice(d.error || `${d.imported} new question(s) added. ${d.warning || ''}`);
      await refresh();
    } catch { setNotice('Sync unavailable. Try CSV/JSON import.'); } finally { setBusy(false); }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      let rows: any[] = [];
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const j = JSON.parse(text);
        rows = Array.isArray(j) ? j : j.problems || j.solvedQuestions || j.submissions || [];
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines.shift()!.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        rows = lines.map((line) => {
          const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim().replace(/^"|"$/g, ''));
          return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
        });
      }
      const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problems: rows }) });
      const d = await r.json();
      setNotice(d.error || `Imported ${d.imported} new question(s); ${d.skipped} already tracked or skipped.`);
      await refresh();
    } catch { setNotice('File could not be parsed. Use a CSV with title/slug/difficulty columns or a JSON array.'); } finally { setBusy(false); }
  }

  async function exportData() {
    try {
      const [qs, hs] = await Promise.all([fetch('/api/questions').then((r) => r.json()), fetch('/api/history?limit=1000').then((r) => r.json())]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), questions: qs.questions, attempts: hs.attempts, attemptsTotal: hs.total }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'dsarecall-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    } catch { setNotice('Backup failed. Check the database connection.'); }
  }

  const filtered = useMemo(
    () => questions.filter((p) => (filter === 'All' || p.difficulty === filter) && `${p.title} ${p.slug} ${p.number ?? ''} ${p.topic} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [questions, filter, query],
  );

  const s = stats ?? { trackedQuestions: 0, attemptedToday: 0, totalAttempts: 0, solved: 0, hint: 0, failed: 0, attemptedOnly: 0 };
  const m = diag?.metrics ?? { tracked: 0, attempts: 0, solvedAttempts: 0, accuracy: 0, activeDays: 0 };
  const struggling = questions.filter((q) => q.lastResult === 'hint' || q.lastResult === 'failed').length;
  const dailyText = !progress.exists ? 'Not started' : progress.status === 'completed' ? `Complete (${progress.answered}/${progress.total})` : `${progress.answered} of ${progress.total} answered`;

  const cards = [
    { label: 'Tracked questions', value: s.trackedQuestions, icon: BookOpen },
    { label: 'Attempted today', value: s.attemptedToday, icon: Target },
    { label: 'Total attempts', value: s.totalAttempts, icon: History },
    { label: 'Solved independently', value: s.solved, icon: CheckCircle2 },
    { label: 'Hints needed', value: s.hint, icon: Lightbulb },
    { label: 'Failed attempts', value: s.failed, icon: XCircle },
  ];
  const factors = [
    { name: 'Consistency', value: m.activeDays, unit: 'active days', desc: 'Distinct India-local days with saved attempts' },
    { name: 'Attempt accuracy', value: `${m.accuracy}%`, unit: 'solved independently', desc: `${m.solvedAttempts} of ${m.attempts} saved attempts` },
    { name: 'Retention', value: s.trackedQuestions, unit: 'tracked questions', desc: 'Questions in your revision pool' },
    { name: 'Speed', value: 'Collecting', unit: 'solve time', desc: 'Timing data is not recorded yet' },
    { name: 'Topic coverage', value: diag?.topics?.length || 0, unit: 'topic groups', desc: 'Topics across tracked questions' },
    { name: 'Weakness signals', value: struggling, unit: 'last result: hint / failed', desc: 'Questions whose most recent attempt was not independent' },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-7 sm:px-5 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500"><Code2 /></span><span><b className="text-xl tracking-tight">DSARecall</b><span className="block text-xs text-slate-400">Practice. Remember. Improve.</span></span></Link>
        <nav className="flex items-center gap-3 text-sm"><Link href="/history" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 hover:bg-white/5"><History size={15} />History</Link><span className={`rounded-full border px-3 py-1.5 text-xs ${db ? 'border-emerald-400/30 text-emerald-300' : 'border-amber-300/30 text-amber-200'}`}>{db ? 'MongoDB connected' : 'Database not reachable'}</span></nav>
      </header>

      {loadError && <p role="alert" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{loadError}</p>}

      <section className="py-8"><p className="mb-3 text-sm font-semibold uppercase tracking-[.22em] text-violet-300">Personal DSA revision</p><h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">Remember what you already solved.</h1><p className="mt-4 max-w-3xl leading-7 text-slate-400">Add the LeetCode questions you solve, then revise random ones from your own bank. Every attempt is stored as its own record.</p></section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">{cards.map((x) => <div key={x.label} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><x.icon className="mb-3 text-violet-300" size={20} /><p className="text-xs text-slate-400">{x.label}</p><p className="mt-1 text-2xl font-bold">{x.value}</p></div>)}</section>

      <section className="my-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/15 to-transparent p-6">
          <div className="flex items-center gap-2 text-violet-200"><Brain size={20} /><b>Daily revision</b></div>
          <h2 className="mt-3 text-2xl font-bold">Today: {dailyText}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Two random questions from your tracked bank, one at a time. Progress is saved in MongoDB, so refreshing is safe.</p>
          <Link href="/test" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400">{!progress.exists ? 'Start daily revision' : progress.status === 'completed' ? 'View summary / practice more' : 'Continue revision'} <Target size={16} /></Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <div className="flex items-center gap-2 text-emerald-300"><Plus size={20} /><b>Add Question</b></div>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void submitAdd({ input: addInput, ...(manual ? { slug: manual.slug, title: manual.title, difficulty: manual.difficulty } : {}) }); }}>
            <label htmlFor="add-input" className="block text-xs text-slate-400">LeetCode number or URL</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input id="add-input" value={addInput} onChange={(e) => { setAddInput(e.target.value); setManual(null); }} placeholder="1  or  https://leetcode.com/problems/two-sum/" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-violet-300/40" />
              <button type="submit" disabled={adding || (!addInput.trim() && !manual)} className="shrink-0 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:opacity-50">{adding ? 'Adding…' : manual ? 'Add manually' : 'Add'}</button>
            </div>
            {manual && (
              <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
                <input aria-label="Slug" value={manual.slug} onChange={(e) => setManual({ ...manual, slug: e.target.value })} placeholder="slug, e.g. two-sum" className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none" />
                <input aria-label="Title" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Title" className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none" />
                <select aria-label="Difficulty" value={manual.difficulty} onChange={(e) => setManual({ ...manual, difficulty: e.target.value })} className="rounded-lg border border-white/10 bg-[#11141c] px-3 py-2 text-sm outline-none"><option>Unknown</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
              </div>
            )}
          </form>
          {addMsg && <p role="status" className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${addMsg.ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>{addMsg.text}</p>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Details are looked up from LeetCode&apos;s unofficial public endpoint. If that fails you can enter the slug and title yourself. Nothing is invented.</p>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent attempts</h2><Link href="/history" className="text-sm text-violet-200 underline underline-offset-4">Full history</Link></div>
          <div className="mt-3 divide-y divide-white/10">
            {recent.map((a) => <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><a href={a.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-violet-200">{a.title}</a><p className="text-xs text-slate-500">{a.localDate} · {a.localTime}</p></div><span className={`shrink-0 text-xs ${RESULT_COLOR[a.result] ?? ''}`}>{RESULT_LABEL[a.result] ?? a.result}</span></div>)}
            {!recent.length && <p className="py-6 text-center text-sm text-slate-500">No attempts yet. Start a revision session.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <div className="flex items-center gap-2 text-emerald-300"><Activity size={20} /><b>Import / sync LeetCode</b></div>
          <label className="mt-4 block text-xs text-slate-400">Public username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={sync} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15} />{busy ? 'Working…' : 'Sync recent accepted'}</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm"><Upload size={15} /> Import CSV/JSON<input type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={(e) => { void importFile(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
            <button onClick={exportData} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm"><FileDown size={15} /> Backup</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">Public sync only sees a limited recent window and never overwrites questions you already track. Import a CSV/JSON export for broader coverage.</p>
          {notice && <p role="status" className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-200">{notice}</p>}
        </div>
      </section>

      <section className="mb-9"><div className="mb-4"><h2 className="text-2xl font-bold">Six-factor diagnosis</h2><p className="mt-1 text-sm text-slate-400">Computed from your recorded attempts, not guesses.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{factors.map((f, i) => <div key={f.name} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><p className="text-xs uppercase tracking-wider text-violet-300">0{i + 1} / {f.name}</p><p className="mt-3 text-2xl font-bold">{f.value}</p><p className="text-sm text-slate-300">{f.unit}</p><p className="mt-2 text-xs leading-5 text-slate-500">{f.desc}</p></div>)}</div></section>

      <section className="pb-8">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><h2 className="text-2xl font-bold">Your tracked questions</h2><p className="mt-1 text-sm text-slate-400">Manually added, synced and imported questions. These form the pool for revision.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><div className="flex items-center gap-2 rounded-xl border border-white/10 px-3"><Search size={16} className="text-slate-400" /><input aria-label="Search questions" className="w-full bg-transparent py-3 text-sm outline-none sm:w-48" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><select aria-label="Filter difficulty" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#11141c] px-3 py-3 text-sm outline-none"><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Unknown</option></select></div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {filtered.map((p, i) => (
            <div key={p.slug} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i ? 'border-t border-white/10' : ''} hover:bg-white/[.03]`}>
              <div className="min-w-0"><h3 className="font-semibold">{p.number ? `${p.number}. ` : ''}{p.title}</h3><p className="mt-1 text-xs text-slate-400"><span className={diffColor(p.difficulty)}>{p.difficulty}</span> · {p.topic || 'Uncategorised'} · {p.attempts} attempt{p.attempts === 1 ? '' : 's'}{p.lastResult ? ` · last: ${RESULT_LABEL[p.lastResult] ?? p.lastResult}` : ''} · {SOURCE[p.source] ?? p.source}{p.dateAdded ? ` · added ${new Date(p.dateAdded).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}</p></div>
              <div className="flex shrink-0 gap-2"><a target="_blank" rel="noreferrer" href={p.url} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:border-violet-300/40">LeetCode ↗</a>{p.hasEditor && <Link href={`/practice/${p.slug}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-violet-400/10">Python editor</Link>}</div>
            </div>
          ))}
          {!filtered.length && <p className="p-8 text-center text-sm text-slate-400">{questions.length ? 'No questions match.' : 'No tracked questions yet. Add one above, sync, or import.'}</p>}
        </div>
      </section>

      {samples.length > 0 && (
        <section className="pb-12">
          <h2 className="text-lg font-bold">Built-in sample questions <span className="text-sm font-normal text-slate-500">— not in your tracked bank</span></h2>
          <p className="mt-1 text-sm text-slate-400">These demos are never counted as solved and never appear in revision unless you add them.</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            {samples.map((p, i) => (
              <div key={p.slug} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${i ? 'border-t border-white/10' : ''}`}>
                <div><h3 className="font-medium">{p.title}</h3><p className="text-xs text-slate-400"><span className={diffColor(p.difficulty)}>{p.difficulty}</span> · {p.topic}</p></div>
                <div className="flex gap-2"><Link href={`/practice/${p.slug}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-violet-400/10">Practice</Link><button disabled={adding} onClick={() => submitAdd({ input: p.slug, slug: p.slug, title: p.title, difficulty: p.difficulty, topic: p.topic })} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50">Add to tracked</button></div>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="pb-6 text-xs leading-5 text-slate-500">Python code execution uses Pyodide in the browser. Keep `.env.local` private and do not commit MongoDB credentials.</p>
    </main>
  );
}
