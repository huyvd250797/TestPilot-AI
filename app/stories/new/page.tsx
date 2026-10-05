"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { PlannedCase } from "@/lib/contracts";

export default function NewStory() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState<"web"|"windows">("web");
  const [plan, setPlan] = useState<{mode?:string; cases: PlannedCase[]; warning?:string} | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const router = useRouter();
  const count = useMemo(() => plan?.cases?.length || 0, [plan]);

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      platform,
      projectId: String(fd.get("projectId") || "") || undefined,
      target: String(fd.get("target") || ""),
      title: String(fd.get("title") || ""),
      story: String(fd.get("story") || ""),
      criteria: String(fd.get("criteria") || "").split("\n").map(x=>x.trim()).filter(Boolean),
    };
    setMeta(payload);
    const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setPlan(await r.json()); setLoading(false);
  }

  async function savePlan() {
    if (!plan || !meta) return; setSaving(true);
    const r = await fetch("/api/stories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: meta.projectId || undefined, title: meta.title, story: meta.story, criteria: meta.criteria, cases: plan.cases }) });
    const j = await r.json(); alert(r.ok ? `Saved (${j.mode || "database"})` : (j.error || "Save failed")); setSaving(false);
  }

  function runCase(testCase: PlannedCase) {
    sessionStorage.setItem("testpilot:selectedCase", JSON.stringify({ projectId: meta?.projectId || "", platform: meta?.platform || platform, target: meta?.target || "", case: testCase }));
    router.push((meta?.platform || platform) === "windows" ? "/runs/windows" : "/runs/new");
  }

  return <AppShell active="stories"><div className="eyebrow">AI Test Design</div><h1 className="title">User Story → Executable Test Plan</h1><p className="muted lead">One planner, two isolated execution targets: Web and Windows Forms.</p>
    <div className="two wideLeft sectionGap"><form className="card" onSubmit={generate}><h2>Requirement</h2>
      <label className="label">Platform</label><select className="input" value={platform} onChange={e=>setPlatform(e.target.value as "web"|"windows")}><option value="web">Web</option><option value="windows">Windows Forms</option></select>
      <label className="label">Project ID <span className="muted">(optional, for persistence)</span></label><input className="input" name="projectId" placeholder="Supabase project UUID"/>
      <label className="label">{platform === "web" ? "Target URL" : "Application path on Windows VM"}</label><input className="input" name="target" placeholder={platform === "web" ? "https://uat.example.com" : 'C:\\Apps\\ERP-UAT\\ERP.exe'} required/>
      <label className="label">Title</label><input className="input" name="title" defaultValue="Create Customer" required/>
      <label className="label">User Story</label><textarea className="textarea" name="story" defaultValue="As an Admin, I want to create a customer so that the customer can use the system." required/>
      <label className="label">Acceptance Criteria · one per line</label><textarea className="textarea tall" name="criteria" defaultValue={'Customer Code is required.\nCustomer Code must be unique.\nEmail must have valid format.\nAfter successful creation, customer appears in Customer List.\nOnly Admin can create Customer.'} required/>
      <button className="btn full" disabled={loading} style={{marginTop:14}}>{loading?"TestPilot is planning...":"Generate Executable Plan"}</button></form>
      <section className="card"><div className="sectionHead"><div><h2>Plan summary</h2><p className="muted">{count} cases · {platform} · {plan?.mode || "not generated"}</p></div>{plan && <button className="btn secondary" disabled={saving} onClick={savePlan}>{saving?"Saving...":"Save Plan"}</button>}</div>{plan?.warning && <p className="notice warnBox">{plan.warning}</p>}{!plan?<div className="empty">Generate a plan to see executable cases.</div>:<div className="caseList">{plan.cases.map((c,i)=><article className="testCase" key={i}><div className="caseTop"><div><span className={`badge ${c.source==='Assumption'?'warn':''}`}>{c.source}</span> {c.acRef && <span className="badge neutral">{c.acRef}</span>}<h3>{c.title}</h3></div><button className="btn mini" onClick={()=>runCase(c)}>Run {platform === "windows" ? "Windows" : "Web"}</button></div><p><b>Expected:</b> {c.expected}</p><details><summary>{c.steps.length} execution steps</summary><ol>{c.steps.map((s,j)=><li key={j}><b>{s.kind.toUpperCase()}</b> · {s.instruction}{s.captureKey?<code> → ${"{"}{s.captureKey}{"}"}</code>:null}</li>)}</ol></details></article>)}</div>}</section></div>
  </AppShell>;
}
