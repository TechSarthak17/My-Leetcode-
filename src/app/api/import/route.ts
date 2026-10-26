import {NextRequest,NextResponse} from 'next/server';
import {connectDB} from '@/lib/db'; import TrackedProblem from '@/models/TrackedProblem';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({})); const rows=Array.isArray(body.problems)?body.problems:[];
 if(!rows.length||rows.length>5000) return NextResponse.json({error:'Upload a JSON array or CSV with 1–5000 problem rows.'},{status:400});
 try{await connectDB();let imported=0;for(const x of rows){const title=String(x.title||x.titleSlug||x.title_slug||x.name||'').trim();const slug=String(x.slug||x.titleSlug||x.title_slug||title).toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');if(!title||!slug)continue;const diff=['Easy','Medium','Hard'].includes(x.difficulty)?x.difficulty:'Unknown';await TrackedProblem.updateOne({userId:'local-user',slug},{$set:{userId:'local-user',slug,title,difficulty:diff,topic:String(x.topic||x.tags||'Imported'),source:'file-import',solvedAt:x.solvedAt?new Date(x.solvedAt):new Date(),nextReviewAt:new Date(Date.now()+86400000)}},{upsert:true});imported++;}return NextResponse.json({ok:true,imported});}catch{return NextResponse.json({error:'MongoDB unavailable. Set MONGODB_URI in .env.local.'},{status:503});}
}
