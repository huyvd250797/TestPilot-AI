import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const platform = url.searchParams.get("platform");
  if (!projectId) return Response.json({ error: "projectId is required." }, { status: 400 });

  let screensQ = db.from("application_screens").select("*").eq("project_id", projectId).order("last_seen_at", { ascending: false });
  if (platform === "web" || platform === "windows") screensQ = screensQ.eq("platform", platform);
  const { data: screens, error } = await screensQ;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const screenIds = (screens || []).map((s:any) => s.id);
  const { data: elements } = screenIds.length ? await db.from("ui_elements").select("*").in("screen_id", screenIds).order("seen_count", { ascending: false }) : { data: [] as any[] };
  let edgesQ = db.from("navigation_edges").select("*").eq("project_id", projectId).order("success_count", { ascending: false });
  if (platform === "web" || platform === "windows") edgesQ = edgesQ.eq("platform", platform);
  const { data: edges } = await edgesQ;
  const { data: settings } = await db.from("application_memory_settings").select("*").eq("project_id", projectId).maybeSingle();

  const byScreen: Record<string, any[]> = {};
  for (const e of elements || []) (byScreen[e.screen_id] ||= []).push(e);
  const hydrated = (screens || []).map((s:any) => ({ ...s, elements: (byScreen[s.id] || []).slice(0, 30) }));
  const stats = {
    screens: hydrated.length,
    active: hydrated.filter((s:any)=>s.status === "ACTIVE").length,
    versions: hydrated.reduce((n:number,s:any)=>n + Number(s.current_version || 1), 0),
    controls: (elements || []).length,
    edges: (edges || []).length,
  };
  return Response.json({ screens: hydrated, edges: edges || [], settings: settings || null, stats });
}
