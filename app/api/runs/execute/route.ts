import { ExecuteRunSchema } from "@/lib/contracts";
import { executeWebCase } from "@/lib/web-runner";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const parsed = ExecuteRunSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!process.env.BROWSERBASE_API_KEY) return Response.json({ error: "Browser execution is not configured. Add BROWSERBASE_API_KEY in Vercel Environment Variables." }, { status: 503 });

  const db = adminDb();
  let runId = crypto.randomUUID();
  if (db && parsed.data.projectId) {
    const { data } = await db.from("test_runs").insert({ project_id: parsed.data.projectId, environment_id: parsed.data.environmentId || null, status: "RUNNING", runtime_context: { targetUrl: parsed.data.targetUrl, caseTitle: parsed.data.case.title } }).select().single();
    if (data?.id) runId = data.id;
  }

  try {
    const output = await executeWebCase({ runId, targetUrl: parsed.data.targetUrl, testCase: parsed.data.case, credentials: parsed.data.credentials });
    if (db) {
      await db.from("test_runs").update({ status: output.result, runtime_context: output.runtime, browser_session_id: output.sessionId, replay_url: output.replayUrl, completed_at: new Date().toISOString() }).eq("id", runId);
      if (output.steps.length) await db.from("execution_steps").insert(output.steps.map((s) => ({ run_id: runId, step_no: s.stepNo, intent: s.instruction, action_type: s.kind.toUpperCase(), expected: s.expected ? { text: s.expected } : {}, actual: { text: s.actual }, result: s.result, after_asset_url: s.screenshotUrl || null, started_at: s.startedAt, ended_at: s.endedAt })));
    }
    return Response.json({ runId, ...output });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (db) await db.from("test_runs").update({ status: "BLOCKED", error_message: message, completed_at: new Date().toISOString() }).eq("id", runId);
    return Response.json({ runId, error: message, result: "BLOCKED" }, { status: 500 });
  }
}
