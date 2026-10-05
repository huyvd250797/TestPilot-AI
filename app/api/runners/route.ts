import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

export async function GET() {
  const db = adminDb();
  if (!db) return Response.json({ mode: "demo", runners: [] });
  const { data, error } = await db.from("runner_agents").select("*").order("last_heartbeat_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const now = Date.now();
  const runners = (data || []).map((r) => ({
    ...r,
    effective_status: now - new Date(r.last_heartbeat_at).getTime() > 90_000 ? "OFFLINE" : r.status,
  }));
  return Response.json({ mode: "database", runners });
}
