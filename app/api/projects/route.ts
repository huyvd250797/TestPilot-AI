import { z } from "zod";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

const Create = z.object({
  name: z.string().min(2),
  environmentName: z.string().default("UAT"),
  targetUrl: z.string().url(),
});

export async function GET() {
  const db = adminDb();
  if (!db) return Response.json({ mode: "demo", projects: [] });
  const { data, error } = await db.from("projects").select("*, environments(*)").order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ mode: "database", projects: data });
}

export async function POST(req: Request) {
  const body = Create.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ mode: "demo", project: { id: crypto.randomUUID(), name: body.name, targetUrl: body.targetUrl } });

  const { data: project, error } = await db.from("projects").insert({ name: body.name }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { data: environment, error: envError } = await db.from("environments").insert({ project_id: project.id, name: body.environmentName, platform: "web", base_url: body.targetUrl }).select().single();
  if (envError) return Response.json({ error: envError.message }, { status: 500 });
  return Response.json({ mode: "database", project, environment });
}
