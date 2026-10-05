import { z } from "zod";

export const TestStepSchema = z.object({
  kind: z.enum(["act", "verify", "capture"]),
  instruction: z.string().min(1),
  expected: z.string().optional(),
  captureKey: z.string().optional(),
});

export const PlannedCaseSchema = z.object({
  id: z.string().optional(),
  source: z.enum(["AC Direct", "AI Derived", "AI Suggested", "Assumption", "Human Added"]),
  acRef: z.string().optional(),
  title: z.string(),
  preconditions: z.array(z.string()).default([]),
  testData: z.record(z.string(), z.string()).default({}),
  expected: z.string(),
  steps: z.array(TestStepSchema).min(1),
});

export const PlanSchema = z.object({
  mode: z.string().optional(),
  cases: z.array(PlannedCaseSchema),
});

export const ExecuteRunSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("web").default("web"),
    projectId: z.string().uuid().optional(),
    environmentId: z.string().uuid().optional(),
    targetUrl: z.string().url(),
    case: PlannedCaseSchema,
    credentials: z.object({ username: z.string().optional(), password: z.string().optional() }).optional(),
    keepData: z.boolean().default(true),
  }),
  z.object({
    platform: z.literal("windows"),
    projectId: z.string().uuid().optional(),
    environmentId: z.string().uuid().optional(),
    appPath: z.string().min(3),
    appArgs: z.string().optional(),
    case: PlannedCaseSchema,
    keepData: z.boolean().default(true),
    closeAppAfterRun: z.boolean().default(true),
  }),
]);

export const WindowsControlTargetSchema = z.object({
  automationId: z.string().optional(),
  name: z.string().optional(),
  controlType: z.string().optional(),
});

export const WindowsCommandSchema = z.object({
  type: z.enum(["CLICK", "TYPE", "CLEAR", "SELECT", "WAIT"]),
  target: WindowsControlTargetSchema.optional(),
  value: z.string().optional(),
  waitMs: z.number().int().min(100).max(10000).optional(),
});

export const WindowsResolverResultSchema = z.object({
  outcome: z.enum(["ACTION", "DONE", "BLOCKED", "VERIFY", "CAPTURE"]),
  command: WindowsCommandSchema.optional(),
  target: WindowsControlTargetSchema.optional(),
  captureProperty: z.enum(["name", "value"]).optional(),
  passed: z.boolean().optional(),
  actual: z.string().optional(),
  evidence: z.string().optional(),
  reason: z.string().optional(),
});

export type PlannedCase = z.infer<typeof PlannedCaseSchema>;
export type TestStep = z.infer<typeof TestStepSchema>;
export type WindowsResolverResult = z.infer<typeof WindowsResolverResultSchema>;
