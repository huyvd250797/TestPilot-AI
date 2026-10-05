import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const flow = [
  ["01", "Design", "User Story + Acceptance Criteria"],
  ["02", "Plan", "AI creates cases, data and expected outputs"],
  ["03", "Execute", "Isolated cloud browser manipulates the real UI"],
  ["04", "Verify", "Expected vs actual + captured runtime outputs"],
  ["05", "Review", "Screenshots, replay and human QA approval"],
];

export default function Home() {
  return <AppShell active="dashboard">
    <div className="topbar"><div><div className="eyebrow">TestPilot AI · Web Execution MVP</div><h1 className="title">Autonomous QA Control Center</h1><p className="muted lead">From User Story to verified software — without source-code access.</p></div><Link href="/runs/new" className="btn">Run Web Test</Link></div>

    <div className="grid metrics">
      <div className="card"><div className="muted">Execution mode</div><div className="metric sm">Cloud Browser</div><span className="statusDot ok">Isolated</span></div>
      <div className="card"><div className="muted">Test lifecycle</div><div className="metric sm">Stateful</div><span className="statusDot ok">Capture & reuse</span></div>
      <div className="card"><div className="muted">Evidence</div><div className="metric sm">Per Step</div><span className="statusDot ok">Screenshot + replay</span></div>
      <div className="card"><div className="muted">Human review</div><div className="metric sm">Auditable</div><span className="statusDot ok">Expected vs actual</span></div>
    </div>

    <div className="two wideLeft">
      <section className="card">
        <div className="sectionHead"><div><div className="eyebrow">Execution pipeline</div><h2>How TestPilot V1.1.1 works</h2></div><span className="badge">LIVE UI TESTING</span></div>
        <div className="timeline">{flow.map(([n,t,d]) => <div className="timelineItem" key={n}><span>{n}</span><div><b>{t}</b><small>{d}</small></div></div>)}</div>
      </section>
      <section className="card accentCard">
        <div className="eyebrow">Start here</div><h2>First real test</h2><p className="muted">Configure Supabase/OpenAI/Browserbase on Vercel, then enter your target URL and a User Story.</p>
        <div className="stack"><Link className="btn" href="/setup">1 · Configure Vercel</Link><Link className="btn secondary" href="/projects">2 · Add Target App</Link><Link className="btn secondary" href="/stories/new">3 · Generate Test Plan</Link><Link className="btn secondary" href="/runs/new">4 · Execute Case</Link></div>
      </section>
    </div>

    <section className="card sectionGap">
      <div className="sectionHead"><div><div className="eyebrow">V1.1.1 architecture</div><h2>Vercel-ready, browser execution stays isolated</h2></div></div>
      <div className="arch"><div>Vercel<br/><small>Next.js Control Plane</small></div><b>→</b><div>TestPilot Brain<br/><small>Planning & verification</small></div><b>→</b><div>Cloud Chromium<br/><small>Browserbase + Stagehand</small></div><b>→</b><div>Target Web App<br/><small>Real black-box UI</small></div></div>
    </section>
  </AppShell>;
}
