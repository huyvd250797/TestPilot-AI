import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { saveScreenshot } from "@/lib/evidence";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  runnerId: z.string().uuid(),
  runId: z.string().uuid(),
  stepNo: z.number().int().min(0),
  kind: z.enum(["act", "verify", "capture"]),
  instruction: z.string(),
  expected: z.string().optional(),
  actual: z.string().default(""),
  result: z.enum(["PASS", "FAIL", "BLOCKED"]),
  capturedOutput: z.record(z.string(), z.unknown()).optional(),
  screenshotBase64: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is required." }, { status: 503 });
  let screenshotUrl: string | null = null;
  if (body.screenshotBase64) {
    const cleaned = body.screenshotBase64.replace(/^data:image\/png;base64,/, "");
    screenshotUrl = await saveScreenshot(body.runId, body.stepNo, Buffer.from(cleaned, "base64"));
  }
  const { error } = await db.from("execution_steps").insert({
    run_id: body.runId,
    step_no: body.stepNo,
    intent: body.instruction,
    action_type: body.kind.toUpperCase(),
    expected: body.expected ? { text: body.expected } : {},
    actual: { text: body.actual },
    captured_output: body.capturedOutput || {},
    result: body.result,
    after_asset_url: screenshotUrl,
    started_at: body.startedAt,
    ended_at: body.endedAt,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await db.from("runner_job_events").insert({ job_id: id, runner_id: body.runnerId, event_type: "STEP", payload: { stepNo: body.stepNo, result: body.result } });
  return Response.json({ ok: true, screenshotUrl });
}
