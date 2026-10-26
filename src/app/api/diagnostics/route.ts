import {NextResponse} from 'next/server'; import {connectDB} from '@/lib/db'; import Attempt from '@/models/Attempt'; import TrackedProblem from '@/models/TrackedProblem';
export async function GET(){try{await connectDB();const [attempts,tracked]=await Promise.all([Attempt.find({userId:'local-user'}).sort({createdAt:-1}).limit(1000).lean(),TrackedProblem.find({userId:'local-user'}).sort({solvedAt:-1}).limit(2000).lean()]);const solved=new Set([...attempts.filter((a:any)=>a.result==='solved').map((a:any)=>a.problemSlug),...tracked.map((x:any)=>x.slug)]);const accepted=attempts.filter((a:any)=>a.result==='solved').length;const accuracy=attempts.length?Math.round(accepted/attempts.length*100):0;const dates=[...new Set(attempts.map((a:any)=>new Date(a.createdAt).toISOString().slice(0,10)))];const topics:Record<string,{total:number;solved:number}>={};for(const t of tracked as any[]){const k=t.topic||'Imported';topics[k]??={total:0,solved:0};topics[k].total++;topics[k].solved++;}const recent=attempts.slice(0,20).map((a:any)=>({problemSlug:a.problemSlug,result:a.result,createdAt:a.createdAt,language:a.language,code:a.code,testMode:a.testMode}));return NextResponse.json({ok:true,tracked,attempts:recent,metrics:{tracked:tracked.length,attempts:attempts.length,accepted,accuracy,activeDays:dates.length,solved:solved.size},topics:Object.entries(topics).map(([topic,v])=>({topic,...v})),databaseConnected:true});} catch (error) {
  console.error("[DSARecall diagnostics error]", error);

  return NextResponse.json(
    {
      ok: false,
      error: "Diagnostics request failed.",
      detail:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
      metrics: {
        tracked: 0,
        attempts: 0,
        accepted: 0,
        accuracy: 0,
        activeDays: 0,
        solved: 0,
      },
      tracked: [],
      attempts: [],
      topics: [],
      databaseConnected: false,
    },
    { status: 500 }
  );
}}