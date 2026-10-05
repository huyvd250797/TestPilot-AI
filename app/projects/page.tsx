"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Environment = { id: string; name: string; platform: "web" | "windows"; base_url?: string | null; app_path?: string | null };
type Project = { id: string; name: string; environments?: Environment[]; targetUrl?: string; appPath?: string; platform?: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState("loading");
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<"web" | "windows">("web");

  async function load() {
    const r = await fetch("/api/projects");
    const j = await r.json();
    setProjects(j.projects || []);
    setMode(j.mode || "database");
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("Saving...");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"), environmentName: fd.get("environmentName"), platform,
      targetUrl: platform === "web" ? fd.get("targetUrl") : undefined,
      appPath: platform === "windows" ? fd.get("appPath") : undefined,
    };
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) return setMessage(typeof j.error === "string" ? j.error : "Create failed");
    setMessage(j.mode === "demo" ? "Demo mode: configure Supabase to persist this target." : "Project saved.");
    if (j.mode === "demo") setProjects((x) => [j.project, ...x]); else await load();
    e.currentTarget.reset();
  }

  return <AppShell active="projects">
    <div className="eyebrow">Target applications</div><h1 className="title">Projects & Environments</h1>
    <p className="muted lead">Register authorized Web UAT targets or the executable path that exists inside your Windows Test VM.</p>
    <div className="two wideLeft sectionGap">
      <form className="card" onSubmit={create}>
        <div className="sectionHead"><h2>Add application</h2><span className="badge">{platform.toUpperCase()}</span></div>
        <label className="label">Platform</label>
        <select className="input" value={platform} onChange={(e)=>setPlatform(e.target.value as "web"|"windows")}><option value="web">Web</option><option value="windows">Windows Forms</option></select>
        <label className="label">Project name</label><input className="input" required name="name" placeholder={platform === "web" ? "CRM UAT" : "ERP Desktop UAT"}/>
        <label className="label">Environment</label><input className="input" required name="environmentName" defaultValue="UAT"/>
        {platform === "web" ? <><label className="label">Target URL</label><input className="input" required type="url" name="targetUrl" placeholder="https://uat.example.com"/></> : <><label className="label">Application path on Windows VM</label><input className="input" required name="appPath" placeholder={'C:\\Apps\\ERP-UAT\\ERP.exe'}/><p className="hint">The path is resolved on the Windows runner VM, not on Vercel.</p></>}
        <button className="btn full" style={{marginTop:16}}>Save Project</button>{message && <p className="notice">{message}</p>}
      </form>
      <section className="card"><div className="sectionHead"><h2>Configured targets</h2><span className="badge">{mode}</span></div>
        {projects.length===0?<div className="empty">No persisted projects yet.</div>:<div className="list">{projects.flatMap(p => p.environments?.length ? p.environments.map(env => <div className="row" key={env.id}><div><b>{p.name} · {env.name}</b><small className="muted">{env.platform === "web" ? env.base_url : env.app_path}</small><code>{p.id}</code></div><span className={`badge ${env.platform === "windows" ? "warn" : ""}`}>{env.platform.toUpperCase()}</span></div>) : [<div className="row" key={p.id}><div><b>{p.name}</b><small className="muted">{p.targetUrl || p.appPath || "No target"}</small><code>{p.id}</code></div><span className="badge">{(p.platform || "web").toUpperCase()}</span></div>])}</div>}
      </section>
    </div>
  </AppShell>;
}
