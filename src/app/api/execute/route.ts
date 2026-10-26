import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { code, stdin = '' } = await req.json();
  if (typeof code !== 'string' || code.length > 20000) return NextResponse.json({error:'Code is missing or too large.'},{status:400});
  const base = process.env.JUDGE0_URL;
  if (!base) return NextResponse.json({mode:'demo',message:'Editor is ready, but code execution is not configured yet. Add a trusted Judge0-compatible endpoint in .env.local. No code was executed.',stdout:'',stderr:'',status:'Not run'});
  try {
    const headers: Record<string,string> = {'Content-Type':'application/json'};
    if (process.env.JUDGE0_API_KEY) headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    if (process.env.JUDGE0_API_HOST) headers['X-RapidAPI-Host'] = process.env.JUDGE0_API_HOST;
    const submit = await fetch(`${base.replace(/\/$/,'')}/submissions?base64_encoded=false&wait=true`,{method:'POST',headers,body:JSON.stringify({source_code:code,language_id:62,stdin,cpu_time_limit:2,wall_time_limit:5,memory_limit:128000})});
    const data = await submit.json();
    if (!submit.ok) return NextResponse.json({error:data.message||'Execution provider returned an error.'},{status:502});
    return NextResponse.json({mode:'judge0',stdout:data.stdout||'',stderr:data.stderr||data.compile_output||'',status:data.status?.description||'Unknown',time:data.time,memory:data.memory});
  } catch { return NextResponse.json({error:'Could not reach the configured code execution provider.'},{status:502}); }
}
