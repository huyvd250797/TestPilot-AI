import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { z } from "zod";
import type { PlannedCase } from "./contracts";
import { saveScreenshot } from "./evidence";

export type ExecutedStep = {
  stepNo: number;
  kind: "act" | "verify" | "capture";
  instruction: string;
  expected?: string;
  actual?: string;
  result: "PASS" | "FAIL" | "BLOCKED";
  screenshotUrl?: string;
  startedAt: string;
  endedAt: string;
};

function applyVars(text: string, vars: Record<string, string>) {
  return text.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ("${" + k + "}"));
}

export async function executeWebCase(args: {
  runId: string;
  targetUrl: string;
  testCase: PlannedCase;
  credentials?: { username?: string; password?: string };
}) {
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error("BROWSERBASE_API_KEY is not configured.");
  }

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create();
  const sessionId = session.id;
  const browser = await browserbase.connect({ apiKey: process.env.BROWSERBASE_API_KEY, sessionId });
  const runtime: Record<string, string> = { ...args.testCase.testData };
  const steps: ExecutedStep[] = [];
  let stagehand: any;

  try {
    stagehand = await Stagehand.create({ browser, cache: { threshold: 2 } });
    const pages = await (browser as any).context.pages();
    const page: any = pages[0];
    await page.goto(args.targetUrl, { waitUntil: "domcontentloaded" });

    if (args.credentials?.username || args.credentials?.password) {
      const loginStarted = new Date().toISOString();
      try {
        if (args.credentials.username) {
          await stagehand.act(`Find the login username or email field and fill it with this test account username: ${args.credentials.username}`);
        }
        if (args.credentials.password) {
          await stagehand.act(`Find the password field and fill it with the provided test password, then submit the login form. Password: ${args.credentials.password}`);
        }
        const shot = await page.screenshot({ type: "png" });
        steps.push({ stepNo: 0, kind: "act", instruction: "Login with test account", actual: "Login interaction completed", result: "PASS", screenshotUrl: await saveScreenshot(args.runId, 0, Buffer.from(shot)), startedAt: loginStarted, endedAt: new Date().toISOString() });
      } catch (error) {
        steps.push({ stepNo: 0, kind: "act", instruction: "Login with test account", actual: error instanceof Error ? error.message : String(error), result: "BLOCKED", startedAt: loginStarted, endedAt: new Date().toISOString() });
      }
    }

    for (let i = 0; i < args.testCase.steps.length; i++) {
      const source = args.testCase.steps[i];
      const stepNo = i + 1;
      const startedAt = new Date().toISOString();
      const instruction = applyVars(source.instruction, runtime);
      const expected = source.expected ? applyVars(source.expected, runtime) : undefined;
      let actual = "";
      let result: ExecutedStep["result"] = "PASS";

      try {
        if (source.kind === "act") {
          await stagehand.act(instruction);
          actual = "Action completed";
        } else if (source.kind === "capture") {
          const extracted = await stagehand.extract(
            `From the current page only, ${instruction}. Return the exact visible value.`,
            z.object({ value: z.string(), evidence: z.string().optional() }),
          );
          actual = extracted.data.value;
          if (source.captureKey) runtime[source.captureKey] = extracted.data.value;
        } else {
          const verification = await stagehand.extract(
            `Evaluate this QA checkpoint using only the current visible page/DOM. Check: ${instruction}. Expected: ${expected || args.testCase.expected}. Do not assume hidden state.`,
            z.object({ passed: z.boolean(), actual: z.string(), evidence: z.string() }),
          );
          actual = `${verification.data.actual}${verification.data.evidence ? ` — ${verification.data.evidence}` : ""}`;
          result = verification.data.passed ? "PASS" : "FAIL";
        }
      } catch (error) {
        actual = error instanceof Error ? error.message : String(error);
        result = "BLOCKED";
      }

      let screenshotUrl: string | undefined;
      try {
        const shot = await page.screenshot({ type: "png" });
        screenshotUrl = await saveScreenshot(args.runId, stepNo, Buffer.from(shot));
      } catch {}

      steps.push({ stepNo, kind: source.kind, instruction, expected, actual, result, screenshotUrl, startedAt, endedAt: new Date().toISOString() });
      if (result === "BLOCKED") break;
    }

    const finalResult = steps.some((s) => s.result === "BLOCKED")
      ? "BLOCKED"
      : steps.some((s) => s.result === "FAIL")
        ? "FAIL"
        : "PASS";

    return {
      result: finalResult,
      sessionId,
      replayUrl: sessionId ? `https://www.browserbase.com/sessions/${sessionId}` : null,
      runtime,
      steps,
    };
  } finally {
    try { if (stagehand) await stagehand.close(); } catch {}
    try { await (browser as any).close(); } catch {}
  }
}
