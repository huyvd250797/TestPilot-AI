import Link from "next/link";

export function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const links = [
    ["dashboard", "/", "Dashboard"],
    ["projects", "/projects", "Projects"],
    ["stories", "/stories/new", "Test Design"],
    ["runs", "/runs/new", "Web Runner"],
    ["replay", "/runs/demo", "Replay"],
    ["setup", "/setup", "Setup"],
  ];
  return <div className="shell">
    <aside className="side">
      <Link href="/" className="brand"><span>TestPilot</span> AI<small>AI-Powered Black-Box Testing</small></Link>
      <nav className="nav">{links.map(([key, href, label]) => <Link key={key} className={active === key ? "active" : ""} href={href}>{label}</Link>)}</nav>
      <div className="sideNote"><b>V1.1.1</b><span>Web Execution MVP</span><span>Cloud browser isolation</span></div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
