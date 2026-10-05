import OpenAI from "openai";
import { z } from "zod";
import { WindowsResolverResultSchema } from "@/lib/contracts";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";
export const maxDuration = 60;

const UiElement = z.object({
  index: z.number().int(),
  automationId: z.string().optional(),
  name: z.string().optional(),
  controlType: z.string().optional(),
  className: z.string().optional(),
  enabled: z.boolean().optional(),
  offscreen: z.boolean().optional(),
});

const Body = z.object({
  runnerId: z.string().uuid(),
  stepKind: z.enum(["act", "verify", "capture"]),
  instruction: z.string().min(1),
  expected: z.string().optional(),
  captureKey: z.string().optional(),
  windowTitle: z.string().optional(),
  ui: z.array(UiElement).max(300),
  actionHistory: z.array(z.string()).max(12).default([]),
});

export async function POST(req: Request) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const body = Body.parse(await req.json());
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ outcome: "BLOCKED", reason: "OPENAI_API_KEY is required for Windows semantic action resolution." });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const uiJson = JSON.stringify(body.ui).slice(0, 45_000);
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: `You are TestPilot AI Windows UI controller. You are controlling an authorized WinForms test application only through a semantic UI Automation snapshot.
Return JSON only with this shape:
{
  "outcome":"ACTION|DONE|BLOCKED|VERIFY|CAPTURE",
  "command":{"type":"CLICK|TYPE|CLEAR|SELECT|WAIT","target":{"automationId":"optional","name":"optional","controlType":"optional"},"value":"optional","waitMs":500},
  "target":{"automationId":"optional","name":"optional","controlType":"optional"},
  "captureProperty":"name|value",
  "passed":true,
  "actual":"what is visible now",
  "evidence":"concise visible evidence",
  "reason":"why blocked"
}

Rules:
- Never invent a control that is absent from the UI snapshot.
- Prefer AutomationId, then exact Name, then ControlType + Name.
- For ACT: choose exactly ONE next command. If the full instruction has already been achieved, return DONE. Use the action history to avoid repeating successful commands. If a menu/dialog must be opened first, choose that one action and TestPilot will observe again.
- TYPE should include only the value to enter. Do not put secrets in reasoning/evidence.
- WAIT is allowed only when the UI appears to be transitioning.
- For CAPTURE: return CAPTURE and choose one visible target. Use captureProperty=value for editable controls, name for labels/text. Do not guess the captured value.
- For VERIFY: return VERIFY with passed/actual/evidence using ONLY visible UI state. If the checkpoint cannot be determined from the visible UI, return BLOCKED instead of guessing.
- This is black-box QA. Destructive actions must be explicitly required by the test instruction.

Window: ${body.windowTitle || "unknown"}
Step kind: ${body.stepKind}
Instruction: ${body.instruction}
Expected: ${body.expected || "not specified"}
Capture key: ${body.captureKey || "none"}
Action history: ${body.actionHistory.join(" | ") || "none"}
UI snapshot: ${uiJson}`,
  });

  const match = response.output_text.match(/\{[\s\S]*\}/);
  if (!match) return Response.json({ outcome: "BLOCKED", reason: "AI resolver returned no JSON." });
  try {
    const parsed = WindowsResolverResultSchema.safeParse(JSON.parse(match[0]));
    if (!parsed.success) return Response.json({ outcome: "BLOCKED", reason: "AI resolver returned an invalid command schema." });
    return Response.json(parsed.data);
  } catch {
    return Response.json({ outcome: "BLOCKED", reason: "AI resolver returned malformed JSON." });
  }
}
