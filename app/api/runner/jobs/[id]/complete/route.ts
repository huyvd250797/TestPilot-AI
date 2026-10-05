import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";

const Body = z.object({
  runnerId: z.string().uuid(),
  runId: z.string().uuid(),
  result: z.enum(["PASS", "FAIL", "BLOCKED"]),
  runtime: z.record(z.string(), z.string()).default({}),
  error: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is required." }, { status: 503 });
  const now = new Date().toISOString();
  const { error: jobError } = await db.from("runner_jobs").update({ status: body.result, result: { runtime: body.runtime }, error_message: body.error || null, completed_at: now }).eq("id", id).eq("assigned_runner_id", body.runnerId);
  if (jobError) return Response.json({ error: jobError.message }, { status: 500 });
  await db.from("test_runs").update({ status: body.result, runtime_context: body.runtime, error_message: body.error || null, completed_at: now }).eq("id", body.runId);
  await db.from("runner_agents").update({ status: "ONLINE", current_job_id: null, last_heartbeat_at: now }).eq("id", body.runnerId);
  await db.from("runner_job_events").insert({ job_id: id, runner_id: body.runnerId, event_type: "COMPLETED", payload: { result: body.result } });
  return Response.json({ ok: true });
}
