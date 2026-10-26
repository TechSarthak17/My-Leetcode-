import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attempt from '@/models/Attempt';
import { problems } from '@/lib/problems';
export async function GET() {
  try { await connectDB(); const attempts = await Attempt.find({userId:'local-user'}).sort({createdAt:-1}).limit(500).lean(); return NextResponse.json({attempts}); }
  catch { return NextResponse.json({attempts:[], warning:'Database is not configured; attempts cannot persist yet.'}); }
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!problems.some(p=>p.slug===body.problemSlug) || typeof body.code!=='string' || body.code.length>50000) return NextResponse.json({error:'Invalid attempt data.'},{status:400});
  try { await connectDB(); const attempt = await Attempt.create({userId:'local-user',problemSlug:body.problemSlug,code:body.code,language:'python',result:body.result==='solved'?'solved':'attempted',testMode:Boolean(body.testMode)}); return NextResponse.json({ok:true,attempt}); }
  catch { return NextResponse.json({error:'Database unavailable. Configure MONGODB_URI in .env.local to save progress.'},{status:503}); }
}
