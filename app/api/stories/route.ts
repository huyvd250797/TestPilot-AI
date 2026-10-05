import { z } from "zod";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

const Body = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(2),
  story: z.string().min(2),
  criteria: z.array(z.string()).min(1),
  cases: z.array(z.any()).optional(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db || !body.projectId) return Response.json({ mode: "demo", id: crypto.randomUUID() });

  const { data: story, error } = await db.from("user_stories").insert({ project_id: body.projectId, title: body.title, story: body.story }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const acRows = body.criteria.map((text, i) => ({ story_id: story.id, position: i + 1, text }));
  const { error: acError } = await db.from("acceptance_criteria").insert(acRows);
  if (acError) return Response.json({ error: acError.message }, { status: 500 });

  if (body.cases?.length) {
    const caseRows = body.cases.map((c) => ({ story_id: story.id, source_type: c.source, title: c.title, expected: { text: c.expected }, test_data: c.testData || {}, preconditions: c.preconditions || [], steps: c.steps || [], ac_ref: c.acRef || null }));
    const { error: caseError } = await db.from("test_cases").insert(caseRows);
    if (caseError) return Response.json({ error: caseError.message }, { status: 500 });
  }
  return Response.json({ mode: "database", id: story.id });
}
