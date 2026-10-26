'use client';
import Editor from '@monaco-editor/react';
export default function CodeEditor({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <div className="overflow-hidden rounded-xl border border-white/10"><Editor height="420px" language="python" theme="vs-dark" value={value} onChange={v=>onChange(v??'')} options={{minimap:{enabled:false},fontSize:14,wordWrap:'on',scrollBeyondLastLine:false,automaticLayout:true,padding:{top:16},lineNumbers:'on',tabSize:4}} /></div>;
}
