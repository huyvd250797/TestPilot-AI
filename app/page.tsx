import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const flow = [
  ["01", "Design", "User Story + Acceptance Criteria"],
  ["02", "Plan", "AI creates cases, data and expected outputs"],
  ["03", "Dispatch", "Web cloud browser or isolated Windows VM"],
  ["04", "Execute", "Observe → semantic action → observe"],
  ["05", "Verify", "Expected vs actual + captured runtime outputs"],
  ["06", "Review", "Screenshots, replay and human QA approval"],
];

export default function Home() {
  return <AppShell active="dashboard">
    <div className="topbar"><div><div className="eyebrow">TestPilot AI · Multi-Platform Execution MVP</div><h1 className="title">Autonomous QA Control Center</h1><p className="muted lead">Black-box testing for real Web and Windows Forms applications — without source-code access.</p></div><div className="actions"><Link href="/runs/new" className="btn secondary">Run Web</Link><Link href="/runs/windows" className="btn">Run Windows</Link></div></div>
    <div className="grid metrics">
      <div className="card"><div className="muted">Platforms</div><div className="metric sm">Web + Windows</div><span className="statusDot ok">Isolated</span></div>
      <div className="card"><div className="muted">Windows control</div><div className="metric sm">UIA3</div><span className="statusDot ok">Semantic selectors</span></div>
      <div className="card"><div className="muted">Test lifecycle</div><div className="metric sm">Stateful</div><span className="statusDot ok">Capture & reuse</span></div>
      <div className="card"><div className="muted">Evidence</div><div className="metric sm">Per Step</div><span className="statusDot ok">Screenshot + audit</span></div>
    </div>
    <div className="two wideLeft"><section className="card"><div className="sectionHead"><div><div className="eyebrow">Execution pipeline</div><h2>How TestPilot V1.2 works</h2></div><span className="badge">BLACK-BOX</span></div><div className="timeline">{flow.map(([n,t,d]) => <div className="timelineItem" key={n}><span>{n}</span><div><b>{t}</b><small>{d}</small></div></div>)}</div></section>
      <section className="card accentCard"><div className="eyebrow">Windows MVP</div><h2>Bring one Windows Test VM online</h2><p className="muted">Install the included .NET agent in an interactive VM session. It registers with Vercel, polls the queue and reports evidence back to TestPilot.</p><div className="stack"><Link className="btn" href="/setup">1 · Configure Runner Secret</Link><Link className="btn secondary" href="/runners">2 · Check Runner Online</Link><Link className="btn secondary" href="/stories/new">3 · Generate Windows Plan</Link><Link className="btn secondary" href="/runs/windows">4 · Queue Windows Test</Link></div></section></div>
    <section className="card sectionGap"><div className="sectionHead"><div><div className="eyebrow">V1.2 architecture</div><h2>One Vercel control plane, two isolated execution engines</h2></div></div><div className="arch"><div>Vercel<br/><small>Next.js + queue APIs</small></div><b>→</b><div>TestPilot Brain<br/><small>Plan + resolve + verify</small></div><b>→</b><div>Web Runner<br/><small>Browserbase + Stagehand</small></div><div>Windows Agent<br/><small>.NET 10 + FlaUI UIA3</small></div><b>→</b><div>Target Apps<br/><small>Web / WinForms UAT</small></div></div></section>
  </AppShell>;
}
