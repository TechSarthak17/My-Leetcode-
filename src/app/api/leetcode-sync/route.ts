import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import TrackedProblem from '@/models/TrackedProblem';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({})); const username=String(body.username||'').trim();
 if(!/^[A-Za-z0-9_-]{2,30}$/.test(username)) return NextResponse.json({error:'Enter a valid public LeetCode username.'},{status:400});
 try {
  // Public community API exposes only a limited recent accepted-submission window, not a guaranteed complete lifetime solved list.
  const res=await fetch(`https://alfa-leetcode-api.onrender.com/${encodeURIComponent(username)}/acSubmission?limit=20`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok) return NextResponse.json({error:'Public LeetCode API is unavailable. Use CSV/JSON import instead.'},{status:502});
  const json=await res.json(); const raw=Array.isArray(json)?json:(json.submission||json.submissions||json.data||[]);
  if(!Array.isArray(raw)) return NextResponse.json({error:'Unexpected public API response. Use CSV/JSON import.'},{status:502});
  const rows=raw.map((x:any)=>({slug:String(x.titleSlug||x.title_slug||x.slug||x.title||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'-'),title:String(x.title||x.titleSlug||x.title_slug||'').trim(),difficulty:['Easy','Medium','Hard'].includes(x.difficulty)?x.difficulty:'Unknown',topic:'LeetCode import',source:'leetcode-public-api',solvedAt:x.timestamp?new Date(Number(x.timestamp)*1000):new Date()})).filter((x:any)=>x.slug&&x.title);
  await connectDB(); let imported=0;
  for(const row of rows){await TrackedProblem.updateOne({userId:'local-user',slug:row.slug},{$set:{...row,userId:'local-user',nextReviewAt:new Date(Date.now()+86400000)}},{upsert:true}); imported++;}
  return NextResponse.json({ok:true,username,imported,warning:'Public sync is limited to the recent accepted submissions returned by the community API. It does not guarantee your complete solved history. Import a CSV/JSON export for fuller coverage.'});
 } catch (error) {
  console.error("[DSARecall LeetCode sync error]", error);

  return NextResponse.json(
    {
      ok: false,
      error: "LeetCode sync failed.",
      detail:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    },
    { status: 503 }
  );
} }
