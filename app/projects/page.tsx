"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Project = { id: string; name: string; environments?: { id: string; name: string; base_url: string }[]; targetUrl?: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState("loading");
  const [message, setMessage] = useState("");
  async function load() { const r = await fetch("/api/projects"); const j = await r.json(); setProjects(j.projects || []); setMode(j.mode || "database"); }
  useEffect(() => { load(); }, []);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("Saving..."); const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name"), environmentName: fd.get("environmentName"), targetUrl: fd.get("targetUrl") }) });
    const j = await r.json(); if (!r.ok) return setMessage(j.error || "Create failed");
    setMessage(j.mode === "demo" ? "Demo mode: project is not persisted until Supabase is configured." : "Project saved.");
    if (j.mode === "demo") setProjects((x) => [j.project, ...x]); else await load();
    e.currentTarget.reset();
  }
  return <AppShell active="projects"><div className="eyebrow">Target applications</div><h1 className="title">Projects & Environments</h1><p className="muted lead">Register the real UAT/staging URL that TestPilot is allowed to manipulate.</p>
    <div className="two wideLeft sectionGap"><form className="card" onSubmit={create}><h2>Add web application</h2><label className="label">Project name</label><input className="input" required name="name" placeholder="CRM UAT"/><label className="label">Environment</label><input className="input" required name="environmentName" defaultValue="UAT"/><label className="label">Target URL</label><input className="input" required type="url" name="targetUrl" placeholder="https://uat.example.com"/><button className="btn full" style={{marginTop:16}}>Save Project</button>{message && <p className="notice">{message}</p>}</form>
    <section className="card"><div className="sectionHead"><h2>Configured targets</h2><span className="badge">{mode}</span></div>{projects.length===0?<div className="empty">No persisted projects yet.</div>:<div className="list">{projects.map(p=><div className="row" key={p.id}><div><b>{p.name}</b><small className="muted">{p.environments?.[0]?.base_url || p.targetUrl || "No URL"}</small><code>{p.id}</code></div><span className="badge">WEB</span></div>)}</div>}</section></div>
  </AppShell>;
}
