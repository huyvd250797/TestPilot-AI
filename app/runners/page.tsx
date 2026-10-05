"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Runner = { id:string; name:string; machine_name:string; version:string; status:string; effective_status:string; current_job_id?:string|null; last_heartbeat_at:string; capabilities?:Record<string,unknown> };

export default function RunnersPage(){
  const [runners,setRunners]=useState<Runner[]>([]); const [mode,setMode]=useState("loading"); const [error,setError]=useState("");
  async function load(){try{const r=await fetch('/api/runners',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load runners');setRunners(j.runners||[]);setMode(j.mode||'database');setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}}
  useEffect(()=>{load();const t=setInterval(load,10000);return()=>clearInterval(t)},[]);
  return <AppShell active="runners"><div className="eyebrow">Windows Runner Pool</div><h1 className="title">Windows Test Machines</h1><p className="muted lead">Each agent runs inside an interactive Windows VM session and controls only that VM's desktop.</p>
    <div className="topbar sectionGap"><div><span className="badge">{mode}</span></div><button className="btn secondary" onClick={load}>Refresh</button></div>
    {error&&<div className="notice errorBox sectionGap">{error}</div>}
    <section className="card sectionGap"><div className="sectionHead"><h2>Registered agents</h2><span className="badge neutral">{runners.length} runner(s)</span></div>{runners.length===0?<div className="empty">No Windows Agent has registered yet. Install the agent from the <code>windows-agent</code> folder on a Windows Test VM.</div>:<div className="runnerGrid">{runners.map(r=><article className="runnerCard" key={r.id}><div className="sectionHead"><div><b>{r.name}</b><small>{r.machine_name}</small></div><span className={`badge ${r.effective_status==='OFFLINE'?'fail':r.effective_status==='BUSY'?'warn':''}`}>{r.effective_status}</span></div><dl><div><dt>Version</dt><dd>{r.version}</dd></div><div><dt>Last heartbeat</dt><dd>{new Date(r.last_heartbeat_at).toLocaleString()}</dd></div><div><dt>Current job</dt><dd><code>{r.current_job_id||'—'}</code></dd></div><div><dt>Runner ID</dt><dd><code>{r.id}</code></dd></div></dl></article>)}</div>}</section>
    <section className="card sectionGap"><h2>Isolation model</h2><div className="arch"><div>TestPilot Vercel<br/><small>Queue & AI resolver</small></div><b>→</b><div>Windows Agent<br/><small>Interactive VM session</small></div><b>→</b><div>FlaUI UIA3<br/><small>Semantic controls</small></div><b>→</b><div>WinForms UAT<br/><small>Real black-box UI</small></div></div></section>
  </AppShell>
}
