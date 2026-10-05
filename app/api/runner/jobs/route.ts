import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";

const LegacyAction = z.object({
  type: z.enum(["OBSERVE","FIND","CLICK","TYPE","SELECT","SCROLL","WAIT","UPLOAD","NAVIGATE","CAPTURE","VERIFY"]),
  target: z.string().optional(),
  value: z.string().optional(),
});

export async function GET(req: Request) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is required." }, { status: 503 });
  const url = new URL(req.url);
  const runnerId = url.searchParams.get("runnerId");
  if (!runnerId) return Response.json({ error: "runnerId is required." }, { status: 400 });

  const { data: candidate, error } = await db.from("runner_jobs")
    .select("*")
    .eq("platform", "windows")
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!candidate) return Response.json({ job: null });

  const { data: claimed } = await db.from("runner_jobs")
    .update({ status: "RUNNING", assigned_runner_id: runnerId, claimed_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("status", "QUEUED")
    .select()
    .maybeSingle();
  if (!claimed) return Response.json({ job: null });

  await db.from("runner_agents").update({ status: "BUSY", current_job_id: claimed.id, last_heartbeat_at: new Date().toISOString() }).eq("id", runnerId);
  await db.from("test_runs").update({ status: "RUNNING", runner_id: runnerId }).eq("id", claimed.run_id);
  await db.from("runner_job_events").insert({ job_id: claimed.id, runner_id: runnerId, event_type: "CLAIMED", payload: { at: new Date().toISOString() } });

  return Response.json({
    job: {
      id: claimed.id,
      runId: claimed.run_id,
      platform: claimed.platform,
      payload: claimed.payload,
    },
  });
}

// Backward-compatible external runner contract from V1.1.
export async function POST(req: Request) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const payload = z.object({ runId: z.string(), platform: z.enum(["web","windows"]), steps: z.array(LegacyAction) }).parse(await req.json());
  return Response.json({ accepted: true, ...payload, note: "Legacy runner contract retained in V1.2." });
}
