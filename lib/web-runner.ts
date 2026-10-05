import "server-only";

import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
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
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error("BROWSERBASE_API_KEY is not configured.");
  }

  // Stagehand v4's browserbase.launch() provisions the Stagehand extension
  // correctly for the new browser session. Creating a raw Browserbase session
  // first and then connecting can miss that extension.
  const browser = await browserbase.launch({
    apiKey,
    ...(process.env.BROWSERBASE_PROJECT_ID
      ? { projectId: process.env.BROWSERBASE_PROJECT_ID }
      : {}),
  });

  const sessionId = browser.sessionId ?? null;
  const runtime: Record<string, string> = { ...args.testCase.testData };
  const steps: ExecutedStep[] = [];
  let stagehand: Stagehand | undefined;

  try {
    // No model is passed here intentionally: Stagehand uses Browserbase Model
    // Gateway. OPENAI_API_KEY remains used by TestPilot's own test planner.
    stagehand = await Stagehand.create({
      browser,
      cache: { threshold: 2 },
    });

    const page =
      (await browser.context.activePage()) ??
      (await browser.context.newPage());

    await page.goto(args.targetUrl, { waitUntil: "domcontentloaded" });

    if (args.credentials?.username || args.credentials?.password) {
      const loginStarted = new Date().toISOString();
      try {
        // Credentials are entered through deterministic locators discovered by
        // Stagehand. The secret values themselves are not placed in the AI
        // instructions.
        if (args.credentials.username) {
          const observed = await stagehand.observe(
            "Find the username or email input used to sign in.",
          );
          const candidate = observed.data?.[0];
          if (!candidate?.selector) {
            throw new Error("Could not find a username/email field.");
          }
          await page.locator(candidate.selector).fill(args.credentials.username);
        }

        if (args.credentials.password) {
          const observed = await stagehand.observe(
            "Find the password input used to sign in.",
          );
          const candidate = observed.data?.[0];
          if (!candidate?.selector) {
            throw new Error("Could not find a password field.");
          }
          await page.locator(candidate.selector).fill(args.credentials.password);

          const submit = await stagehand.observe(
            "Find the button or control that submits the sign-in form.",
          );
          const submitCandidate = submit.data?.[0];
          if (submitCandidate?.selector) {
            await page.locator(submitCandidate.selector).click();
          } else {
            await stagehand.act("Submit the sign-in form.");
          }
        }

        const shot = await page.screenshot({ type: "png" });
        steps.push({
          stepNo: 0,
          kind: "act",
          instruction: "Login with test account",
          actual: "Login interaction completed",
          result: "PASS",
          screenshotUrl: await saveScreenshot(
            args.runId,
            0,
            Buffer.from(shot),
          ),
          startedAt: loginStarted,
          endedAt: new Date().toISOString(),
        });
      } catch (error) {
        steps.push({
          stepNo: 0,
          kind: "act",
          instruction: "Login with test account",
          actual: error instanceof Error ? error.message : String(error),
          result: "BLOCKED",
          startedAt: loginStarted,
          endedAt: new Date().toISOString(),
        });
      }
    }

    for (let i = 0; i < args.testCase.steps.length; i++) {
      const source = args.testCase.steps[i];
      const stepNo = i + 1;
      const startedAt = new Date().toISOString();
      const instruction = applyVars(source.instruction, runtime);
      const expected = source.expected
        ? applyVars(source.expected, runtime)
        : undefined;
      let actual = "";
      let result: ExecutedStep["result"] = "PASS";

      try {
        if (source.kind === "act") {
          await stagehand.act(instruction);
          actual = "Action completed";
        } else if (source.kind === "capture") {
          const extracted = await stagehand.extract(
            `From the current page only, ${instruction}. Return the exact visible value.`,
            z.object({
              value: z.string(),
              evidence: z.string().optional(),
            }),
          );
          actual = extracted.data.value;
          if (source.captureKey) {
            runtime[source.captureKey] = extracted.data.value;
          }
        } else {
          const verification = await stagehand.extract(
            `Evaluate this QA checkpoint using only the current visible page/DOM. Check: ${instruction}. Expected: ${expected || args.testCase.expected}. Do not assume hidden state.`,
            z.object({
              passed: z.boolean(),
              actual: z.string(),
              evidence: z.string(),
            }),
          );
          actual = `${verification.data.actual}${
            verification.data.evidence
              ? ` — ${verification.data.evidence}`
              : ""
          }`;
          result = verification.data.passed ? "PASS" : "FAIL";
        }
      } catch (error) {
        actual = error instanceof Error ? error.message : String(error);
        result = "BLOCKED";
      }

      let screenshotUrl: string | undefined;
      try {
        const shot = await page.screenshot({ type: "png" });
        screenshotUrl = await saveScreenshot(
          args.runId,
          stepNo,
          Buffer.from(shot),
        );
      } catch {
        // Evidence upload failure must not erase the execution result.
      }

      steps.push({
        stepNo,
        kind: source.kind,
        instruction,
        expected,
        actual,
        result,
        screenshotUrl,
        startedAt,
        endedAt: new Date().toISOString(),
      });

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
      replayUrl: sessionId
        ? `https://www.browserbase.com/sessions/${sessionId}`
        : null,
      runtime,
      steps,
    };
  } finally {
    try {
      if (stagehand) await stagehand.close();
    } catch {
      // Best-effort cleanup.
    }
    try {
      await browser.close();
    } catch {
      // Best-effort cleanup.
    }
  }
}
