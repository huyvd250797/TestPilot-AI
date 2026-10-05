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

export const ExecuteRunSchema = z.object({
  projectId: z.string().uuid().optional(),
  environmentId: z.string().uuid().optional(),
  targetUrl: z.string().url(),
  case: PlannedCaseSchema,
  credentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  keepData: z.boolean().default(true),
});

export type PlannedCase = z.infer<typeof PlannedCaseSchema>;
export type TestStep = z.infer<typeof TestStepSchema>;
