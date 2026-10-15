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
    <div className="topbar"><div><div className="eyebrow">TestPilot AI · Application Memory & UI Map</div><h1 className="title">Autonomous QA Control Center</h1><p className="muted lead">Black-box testing for real Web and Windows Forms applications — without source-code access.</p></div><div className="actions"><Link href="/runs/new" className="btn secondary">Run Web</Link><Link href="/runs/windows" className="btn">Run Windows</Link></div></div>
    <div className="grid metrics">
      <div className="card"><div className="muted">Platforms</div><div className="metric sm">Web + Windows</div><span className="statusDot ok">Isolated</span></div>
      <div className="card"><div className="muted">Windows control</div><div className="metric sm">UIA3</div><span className="statusDot ok">Semantic selectors</span></div>
      <div className="card"><div className="muted">Test lifecycle</div><div className="metric sm">Stateful</div><span className="statusDot ok">Capture & reuse</span></div>
      <div className="card"><div className="muted">Application Memory</div><div className="metric sm">Learned UI Map</div><span className="statusDot ok">Dedup + versioned</span></div>
    </div>
    <div className="two wideLeft"><section className="card"><div className="sectionHead"><div><div className="eyebrow">Execution pipeline</div><h2>How TestPilot V1.3 works</h2></div><span className="badge">BLACK-BOX</span></div><div className="timeline">{flow.map(([n,t,d]) => <div className="timelineItem" key={n}><span>{n}</span><div><b>{t}</b><small>{d}</small></div></div>)}</div></section>
      <section className="card accentCard"><div className="eyebrow">V1.3 Memory</div><h2>Let TestPilot learn the application</h2><p className="muted">Every successful run can promote canonical screens, useful controls and navigation edges. Repeated screens update confidence instead of duplicating rows.</p><div className="stack"><Link className="btn" href="/memory">1 · Open Application Memory</Link><Link className="btn secondary" href="/stories/new">2 · Generate a Test Plan</Link><Link className="btn secondary" href="/runs/new">3 · Run Web Test</Link><Link className="btn secondary" href="/runs/windows">4 · Run Windows Test</Link></div></section></div>
    <section className="card sectionGap"><div className="sectionHead"><div><div className="eyebrow">V1.3 architecture</div><h2>One Vercel control plane, two isolated execution engines</h2></div></div><div className="arch"><div>Vercel<br/><small>Next.js + queue APIs</small></div><b>→</b><div>TestPilot Brain<br/><small>Plan + resolve + verify</small></div><b>↔</b><div>Application Memory<br/><small>Screens + controls + graph</small></div><b>→</b><div>Web Runner<br/><small>Browserbase + Stagehand</small></div><div>Windows Agent<br/><small>.NET 10 + FlaUI UIA3</small></div><b>→</b><div>Target Apps<br/><small>Web / WinForms UAT</small></div></div></section>
  </AppShell>;
}
