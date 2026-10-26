# DSARecall — Python DSA practice and revision

A free-first personal DSA workspace built with Next.js, TypeScript, Tailwind CSS, Monaco Editor, Pyodide (Python in WebAssembly), and optional MongoDB Atlas cloud persistence.

## Included in this review build
- Dashboard and searchable/filterable problem library.
- Python editor with browser-side Python execution using Pyodide; no paid compiler API is required for the basic practice workflow.
- Five sample DSA questions with Python starter code and hints.
- Random mixed-difficulty recall test and written approach reflection.
- MongoDB API routes for saving attempts when a database is configured.
- Browser execution: the first run downloads the Python runtime from jsDelivr; internet is needed for this.

## Run on Windows PowerShell
1. Install Node.js 20.9+ (Node 22 LTS recommended).
2. Extract this ZIP and open the `dsarecall` folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   ```
5. Optional cloud storage: create a MongoDB Atlas free cluster, create a database user, allow your IP in Network Access, then put the connection URI in `MONGODB_URI` inside `.env.local`. Do not commit `.env.local` to GitHub.
6. Start the app with `npm run dev` and open http://localhost:3000.

## Python runtime and safety
Pyodide is the open-source Python interpreter compiled to WebAssembly and runs code in the browser. Basic execution is free and does not require a hosted compiler API. It is not a full online judge: stdin-based programs and hidden test-case judging are not implemented in this review build; add `print(...)` calls in your solution to see outputs. The first run requires internet to download the runtime. Browser-side execution is safer than executing arbitrary code on your server, but do not treat it as a hardened sandbox for sensitive data.

## Current limitations to review
- This is a reviewable MVP, not a production multi-user app.
- The five included questions are sample problems; expand `src/lib/problems.ts` for your own practice list.
- Daily tests randomly choose from the available question bank and collect your written approach; they do not automatically judge code correctness yet.
- Cloud attempt routes use a single personal placeholder identity (`local-user`) and are not secure for public multi-user deployment. Add authentication and per-user authorization before deploying publicly.
- The UI revision calendar is a plan/preview; durable spaced-repetition scheduling and full local-first/cloud-sync conflict handling still need implementation.
- Free service tiers have quotas and terms that can change.

## Key files
- `src/app/page.tsx` — dashboard
- `src/app/practice/[slug]/page.tsx` — practice page and Python runtime
- `src/app/test/page.tsx` — random recall test
- `src/lib/problems.ts` — question bank and Python starter code
- `src/app/api/attempts/route.ts` — MongoDB attempt persistence
- `src/lib/db.ts` — MongoDB connection


## Upgrade: LeetCode import and diagnostics

- Dashboard includes a public username sync attempt for `TechSarthak17`, CSV/JSON import, JSON backup, and six diagnostic factors.
- Public sync uses a community-maintained endpoint for a limited recent accepted-submission window; it does **not** promise all lifetime solved questions. Endpoint availability can change.
- Import CSV headers such as `title,slug,difficulty,topic,solvedAt` or a JSON array of objects with `title`/`titleSlug`, optional `slug`, `difficulty`, `topic`, and `solvedAt`.
- Set `MONGODB_URI` in `.env.local` to persist tracked problems and attempts in Atlas. This starter is designed for one local user (`local-user`), not multi-user public deployment. Add real authentication and authorization before exposing it to the internet.
- Six-factor metrics are data-dependent. Solve time is shown as collecting until timed-session telemetry is implemented; do not treat missing metrics as a zero score.
- Python execution uses Pyodide in-browser. It is not a secure server-side online judge and cannot reproduce all LeetCode runtime constraints.

## Revision system (random daily revision + attempt history)

- **Add Question** (dashboard): enter a LeetCode number, URL or slug. Details come from LeetCode's *unofficial* public GraphQL endpoint; if lookup fails you get a manual slug/title form. Duplicates are blocked by slug and by question number.
- **Daily revision** (`/test`): 2 random questions from your *tracked* questions, one at a time. The session is stored in MongoDB (`RevisionSession`), so a refresh restores it. The daily date boundary is `Asia/Kolkata`.
- **Practice 2 More Random Questions** creates extra sessions that avoid every question already shown today; when the unseen pool is exhausted you are offered a reshuffle.
- **History** (`/history`): every attempt is its own `Attempt` document (never overwritten), with search, result and date filters, per-question attempt counts and daily summaries.
- Built-in sample questions are only practice material; they are never counted as tracked/solved unless you click "Add to tracked".
- The old `DailyRevision` model / `/api/revision/today` route (if you have them locally) are no longer used and can be deleted; their data is left untouched in MongoDB.
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
