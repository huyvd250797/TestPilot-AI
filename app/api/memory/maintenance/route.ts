import { z } from "zod";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

const Body = z.object({ projectId: z.string().uuid(), staleAfterDays: z.number().int().min(7).max(3650).default(180), maxVersions: z.number().int().min(1).max(50).default(5) });

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const cutoff = new Date(Date.now() - body.staleAfterDays * 86400000).toISOString();
  const { data: stale } = await db.from("application_screens").update({ status: "STALE", updated_at: new Date().toISOString() }).eq("project_id", body.projectId).lt("last_seen_at", cutoff).neq("status", "ARCHIVED").select("id");
  const { data: screens } = await db.from("application_screens").select("id").eq("project_id", body.projectId);
  let prunedVersions = 0;
  for (const screen of screens || []) {
    const { data: versions } = await db.from("screen_versions").select("id,version").eq("screen_id", screen.id).order("version", { ascending: false });
    const remove = (versions || []).slice(body.maxVersions);
    if (remove.length) {
      await db.from("screen_versions").delete().in("id", remove.map((x:any)=>x.id));
      prunedVersions += remove.length;
    }
  }
  await db.from("application_memory_settings").upsert({ project_id: body.projectId, stale_after_days: body.staleAfterDays, max_versions: body.maxVersions, updated_at: new Date().toISOString() });
  return Response.json({ ok: true, staleMarked: stale?.length || 0, prunedVersions });
}
