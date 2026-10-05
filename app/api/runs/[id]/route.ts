import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: run, error } = await db.from("test_runs").select("*").eq("id", id).single();
  if (error) return Response.json({ error: error.message }, { status: 404 });
  const { data: steps } = await db.from("execution_steps").select("*").eq("run_id", id).order("step_no");
  const { data: reviews } = await db.from("test_reviews").select("*").eq("run_id", id).order("created_at", { ascending: false });
  return Response.json({ run, steps: steps || [], reviews: reviews || [] });
}
