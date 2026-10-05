import OpenAI from "openai";
import { z } from "zod";
import { PlanSchema } from "@/lib/contracts";
export const runtime = "nodejs";
export const maxDuration = 60;

const Req = z.object({
  title: z.string(),
  story: z.string(),
  criteria: z.array(z.string()).min(1),
});

function fallback(criteria: string[]) {
  return {
    mode: "demo",
    cases: criteria.flatMap((ac, i) => [
      {
        source: "AC Direct" as const,
        acRef: `AC${i + 1}`,
        title: `Verify ${ac}`,
        preconditions: ["Target application is reachable", "Required test role/account is available"],
        testData: { runKey: `AUTO_QA_AC${i + 1}` },
        expected: ac,
        steps: [
          { kind: "act" as const, instruction: `Navigate through the application to the feature related to AC${i + 1}: ${ac}` },
          { kind: "act" as const, instruction: `Perform the business action needed to test AC${i + 1} using safe test data. Use AUTO_QA_AC${i + 1} when a unique value is needed.` },
          { kind: "verify" as const, instruction: `Verify AC${i + 1}: ${ac}`, expected: ac },
        ],
      },
      {
        source: "AI Derived" as const,
        acRef: `AC${i + 1}`,
        title: `Negative / boundary coverage for AC${i + 1}`,
        preconditions: ["Target feature is accessible"],
        testData: {},
        expected: `Invalid or boundary input related to AC${i + 1} is handled safely without corrupting persisted data.`,
        steps: [
          { kind: "act" as const, instruction: `Navigate to the feature related to AC${i + 1}: ${ac}` },
          { kind: "act" as const, instruction: `Exercise one high-value invalid or boundary condition directly related to AC${i + 1}. Do not invent a new business requirement.` },
          { kind: "verify" as const, instruction: `Verify the system handled the invalid or boundary condition without violating AC${i + 1}.` },
        ],
      },
    ]),
  };
}

export async function POST(req: Request) {
  const body = Req.parse(await req.json());
  if (!process.env.OPENAI_API_KEY) return Response.json(fallback(body.criteria));

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: `You are TestPilot AI's senior black-box QA planner. Produce JSON only, matching this exact shape:
{
  "mode":"ai",
  "cases":[{
    "source":"AC Direct|AI Derived|AI Suggested|Assumption",
    "acRef":"AC1",
    "title":"...",
    "preconditions":["..."],
    "testData":{"key":"value"},
    "expected":"observable expected result established before execution",
    "steps":[
      {"kind":"act|verify|capture","instruction":"natural-language browser instruction","expected":"optional","captureKey":"optional_runtime_variable"}
    ]
  }]
}

Rules:
- Acceptance Criteria are the source of truth.
- Never promote an assumption to a requirement.
- Create practical browser-executable steps. Each important outcome must be verified, not merely clicked.
- If the system is expected to generate an ID/code, add a capture step with captureKey and reference it later as \${captureKey}.
- For uniqueness/persistence ACs, verify the final persisted state, e.g. return to list/search and confirm the correct record count/state.
- Prefer generated test data with AUTO_QA namespace when business format allows it.
- Do not include passwords or secrets in testData.
- Keep 1-3 high-value cases per AC for this MVP.

User Story title: ${body.title}
User Story: ${body.story}
Acceptance Criteria:
${body.criteria.map((x, i) => `AC${i + 1}: ${x}`).join("\n")}`,
    });

    const match = response.output_text.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ ...fallback(body.criteria), warning: "AI returned no JSON; demo planner used." });
    const parsed = PlanSchema.safeParse(JSON.parse(match[0]));
    if (!parsed.success) return Response.json({ ...fallback(body.criteria), warning: "AI plan schema was invalid; demo planner used." });
    return Response.json({ mode: "ai", cases: parsed.data.cases });
  } catch {
    return Response.json({ ...fallback(body.criteria), warning: "AI call failed; demo planner used." });
  }
}
