import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";

const Body = z.object({ runnerId: z.string().uuid(), currentJobId: z.string().uuid().nullable().optional() });

export async function POST(req: Request) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is required." }, { status: 503 });
  const { error } = await db.from("runner_agents").update({
    status: body.currentJobId ? "BUSY" : "ONLINE",
    current_job_id: body.currentJobId || null,
    last_heartbeat_at: new Date().toISOString(),
  }).eq("id", body.runnerId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
