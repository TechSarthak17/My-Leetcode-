export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Unknown';
export type Meta = { number: number | null; slug: string; title: string; difficulty: Difficulty; tags: string[] };
export type Parsed = { kind: 'number'; number: number } | { kind: 'slug'; slug: string };

export const leetcodeUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export function normalizeSlug(value: string): string {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function asDifficulty(value: unknown): Difficulty {
  return value === 'Easy' || value === 'Medium' || value === 'Hard' ? value : 'Unknown';
}

/** Accepts a question number, a LeetCode problem URL, or a bare slug. */
export function parseInput(raw: string): Parsed | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{1,5}$/.test(v)) {
    const n = Number(v);
    return n > 0 ? { kind: 'number', number: n } : null;
  }
  if (/^(www\.)?leetcode\.(com|cn)\//i.test(v)) return parseInput(`https://${v}`);
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (!/(^|\.)leetcode\.(com|cn)$/i.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/problems\/([a-z0-9-]+)/i);
      return m ? { kind: 'slug', slug: m[1].toLowerCase() } : null;
    } catch {
      return null;
    }
  }
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(v)) return { kind: 'slug', slug: v.toLowerCase() };
  return null;
}

// NOTE: this is LeetCode's unofficial, undocumented GraphQL endpoint. It can change or
// block server requests at any time, so callers must always offer a manual fallback.
async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com/problemset/', 'User-Agent': 'DSARecall/1.0' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`LeetCode responded with HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'LeetCode GraphQL error');
  return json.data;
}

type RawQ = { questionFrontendId?: string; title?: string; titleSlug?: string; difficulty?: string; topicTags?: { name: string }[] };

function toMeta(q: RawQ | null | undefined): Meta | null {
  if (!q?.titleSlug || !q.title) return null;
  const n = Number(q.questionFrontendId);
  return {
    number: Number.isFinite(n) && n > 0 ? n : null,
    slug: q.titleSlug.toLowerCase(),
    title: q.title,
    difficulty: asDifficulty(q.difficulty),
    tags: (q.topicTags ?? []).map((t) => t.name).filter(Boolean),
  };
}

export async function fetchBySlug(slug: string): Promise<Meta | null> {
  const data = await gql(
    'query q($titleSlug:String!){question(titleSlug:$titleSlug){questionFrontendId title titleSlug difficulty topicTags{name}}}',
    { titleSlug: slug },
  );
  return toMeta(data?.question);
}

/** Resolves a question number; only an exact frontend-id match is accepted (never guessed). */
export async function fetchByNumber(num: number): Promise<Meta | null> {
  const data = await gql(
    `query s($categorySlug:String,$limit:Int,$skip:Int,$filters:QuestionListFilterInput){
      problemsetQuestionList:questionList(categorySlug:$categorySlug,limit:$limit,skip:$skip,filters:$filters){
        questions:data{questionFrontendId title titleSlug difficulty topicTags{name}}
      }}`,
    { categorySlug: '', limit: 50, skip: 0, filters: { searchKeywords: String(num) } },
  );
  const list: RawQ[] = data?.problemsetQuestionList?.questions ?? [];
  return toMeta(list.find((q) => Number(q.questionFrontendId) === num));
}
