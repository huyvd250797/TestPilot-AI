import { ExecuteRunSchema } from "@/lib/contracts";
import { executeWebCase } from "@/lib/web-runner";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const parsed = ExecuteRunSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = adminDb();

  if (parsed.data.platform === "windows") {
    if (!db) return Response.json({ error: "Supabase is required for Windows Runner queue/persistence." }, { status: 503 });
    if (!process.env.RUNNER_SHARED_SECRET) return Response.json({ error: "RUNNER_SHARED_SECRET is not configured in Vercel." }, { status: 503 });

    let runId = crypto.randomUUID();
    const { data: run, error: runError } = await db.from("test_runs").insert({
      project_id: parsed.data.projectId || null,
      environment_id: parsed.data.environmentId || null,
      platform: "windows",
      status: "QUEUED",
      runtime_context: { appPath: parsed.data.appPath, caseTitle: parsed.data.case.title, ...parsed.data.case.testData },
    }).select().single();
    if (runError) return Response.json({ error: runError.message }, { status: 500 });
    runId = run.id;

    const payload = {
      appPath: parsed.data.appPath,
      appArgs: parsed.data.appArgs || "",
      testCase: parsed.data.case,
      keepData: parsed.data.keepData,
      closeAppAfterRun: parsed.data.closeAppAfterRun,
    };
    const { data: job, error: jobError } = await db.from("runner_jobs").insert({
      run_id: runId,
      platform: "windows",
      status: "QUEUED",
      payload,
    }).select().single();
    if (jobError) {
      await db.from("test_runs").update({ status: "BLOCKED", error_message: jobError.message, completed_at: new Date().toISOString() }).eq("id", runId);
      return Response.json({ error: jobError.message }, { status: 500 });
    }
    return Response.json({ runId, jobId: job.id, platform: "windows", result: "QUEUED" }, { status: 202 });
  }

  if (!process.env.BROWSERBASE_API_KEY) return Response.json({ error: "Browser execution is not configured. Add BROWSERBASE_API_KEY in Vercel Environment Variables." }, { status: 503 });

  let runId = crypto.randomUUID();
  if (db && parsed.data.projectId) {
    const { data } = await db.from("test_runs").insert({
      project_id: parsed.data.projectId,
      environment_id: parsed.data.environmentId || null,
      platform: "web",
      status: "RUNNING",
      runtime_context: { targetUrl: parsed.data.targetUrl, caseTitle: parsed.data.case.title },
    }).select().single();
    if (data?.id) runId = data.id;
  }

  try {
    const output = await executeWebCase({ runId, targetUrl: parsed.data.targetUrl, testCase: parsed.data.case, credentials: parsed.data.credentials });
    if (db) {
      await db.from("test_runs").update({ status: output.result, runtime_context: output.runtime, browser_session_id: output.sessionId, replay_url: output.replayUrl, completed_at: new Date().toISOString() }).eq("id", runId);
      if (output.steps.length) await db.from("execution_steps").insert(output.steps.map((s) => ({ run_id: runId, step_no: s.stepNo, intent: s.instruction, action_type: s.kind.toUpperCase(), expected: s.expected ? { text: s.expected } : {}, actual: { text: s.actual }, result: s.result, after_asset_url: s.screenshotUrl || null, started_at: s.startedAt, ended_at: s.endedAt })));
    }
    return Response.json({ runId, platform: "web", ...output });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (db) await db.from("test_runs").update({ status: "BLOCKED", error_message: message, completed_at: new Date().toISOString() }).eq("id", runId);
    return Response.json({ runId, error: message, result: "BLOCKED" }, { status: 500 });
  }
}
