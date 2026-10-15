import "server-only";

import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
import type { PlannedCase } from "./contracts";
import { saveScreenshot } from "./evidence";
import { rememberNavigation, rememberScreenObservation } from "./application-memory";

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
  memoryScreenId?: string;
  memoryFingerprint?: string;
};

function applyVars(text: string, vars: Record<string, string>) {
  return text.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ("${" + k + "}"));
}

async function captureWebUi(page: any) {
  try {
    const data = await page.evaluate(() => {
      const selectorFor = (el: Element) => {
        const id = (el as HTMLElement).id;
        if (id) return `#${id}`;
        const name = el.getAttribute("name");
        if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
        const testId = el.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
        return "";
      };
      const nodes = Array.from(document.querySelectorAll("button,input,select,textarea,a,[role],[data-testid]"));
      return {
        name: document.title || location.pathname || "Web page",
        locationHint: location.href,
        elements: nodes.slice(0, 180).map((el) => {
          const h = el as HTMLElement; const input = el as HTMLInputElement;
          return {
            automationId: el.getAttribute("data-testid") || h.id || null,
            name: el.getAttribute("aria-label") || el.getAttribute("title") || (h.innerText || "").trim().slice(0, 120) || el.getAttribute("name") || el.getAttribute("placeholder"),
            role: el.getAttribute("role") || el.tagName.toLowerCase(),
            controlType: el.tagName.toLowerCase(),
            className: h.className && typeof h.className === "string" ? h.className.slice(0, 160) : null,
            selector: selectorFor(el),
            placeholder: el.getAttribute("placeholder"),
            inputType: input.type || null,
            enabled: !(input.disabled),
            offscreen: false,
          };
        }),
      };
    });
    return data as { name:string; locationHint:string; elements:any[] };
  } catch { return null; }
}

export async function executeWebCase(args: {
  runId: string;
  targetUrl: string;
  testCase: PlannedCase;
  credentials?: { username?: string; password?: string };
  projectId?: string;
  environmentId?: string;
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
  let previousMemoryScreenId: string | null = null;
  let previousMemoryAction = "Open target application";

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
        const loginScreenshotUrl = await saveScreenshot(args.runId, 0, Buffer.from(shot));
        let loginMemory: Awaited<ReturnType<typeof rememberScreenObservation>> = null;
        const loginUi = await captureWebUi(page);
        if (loginUi && args.projectId) {
          try { loginMemory = await rememberScreenObservation({ projectId: args.projectId, environmentId: args.environmentId, platform: "web", ...loginUi, screenshotUrl: loginScreenshotUrl, successfulUse: true }); } catch {}
        }
        if (loginMemory?.screenId) previousMemoryScreenId = loginMemory.screenId;
        steps.push({
          stepNo: 0,
          kind: "act",
          instruction: "Login with test account",
          actual: "Login interaction completed",
          result: "PASS",
          screenshotUrl: loginScreenshotUrl,
          memoryScreenId: loginMemory?.screenId,
          memoryFingerprint: loginMemory?.fingerprint,
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

      let stepMemory: Awaited<ReturnType<typeof rememberScreenObservation>> = null;
      const uiMemory = await captureWebUi(page);
      if (uiMemory && args.projectId) {
        try {
          stepMemory = await rememberScreenObservation({ projectId: args.projectId, environmentId: args.environmentId, platform: "web", ...uiMemory, screenshotUrl: screenshotUrl || null, successfulUse: result === "PASS" });
          if (previousMemoryScreenId && stepMemory?.screenId && previousMemoryScreenId !== stepMemory.screenId) {
            await rememberNavigation({ projectId: args.projectId, environmentId: args.environmentId, platform: "web", fromScreenId: previousMemoryScreenId, toScreenId: stepMemory.screenId, actionType: source.kind.toUpperCase(), actionSignature: previousMemoryAction, success: result !== "BLOCKED" });
          }
          if (stepMemory?.screenId) previousMemoryScreenId = stepMemory.screenId;
          previousMemoryAction = instruction;
        } catch {}
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
        memoryScreenId: stepMemory?.screenId,
        memoryFingerprint: stepMemory?.fingerprint,
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
