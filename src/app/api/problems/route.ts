import { NextResponse } from 'next/server';
import { problems } from '@/lib/problems';
import { connectDB } from '@/lib/db';
import Attempt from '@/models/Attempt';
export async function GET() {
  let attempts: {problemSlug:string;result:string;createdAt:Date}[] = [];
  try { await connectDB(); attempts = await Attempt.find({userId:'local-user'}).select('problemSlug result createdAt').lean() as typeof attempts; } catch { /* local demo still works without database */ }
  const solved = new Set(attempts.filter(a=>a.result==='solved').map(a=>a.problemSlug));
  const payload = problems.map(p=>({...p, starterCode:p.starterCode, solved:solved.has(p.slug), attempts:attempts.filter(a=>a.problemSlug===p.slug).length}));
  return NextResponse.json({problems:payload, databaseConnected: Boolean(process.env.MONGODB_URI)});
}
