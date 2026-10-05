import { z } from "zod";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";

const Create = z.object({
  name: z.string().min(2),
  environmentName: z.string().default("UAT"),
  platform: z.enum(["web", "windows"]).default("web"),
  targetUrl: z.string().optional(),
  appPath: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.platform === "web") {
    const parsed = z.string().url().safeParse(v.targetUrl);
    if (!parsed.success) ctx.addIssue({ code: "custom", message: "Valid target URL is required for web environments.", path: ["targetUrl"] });
  }
  if (v.platform === "windows" && (!v.appPath || v.appPath.trim().length < 3)) {
    ctx.addIssue({ code: "custom", message: "Application path is required for Windows environments.", path: ["appPath"] });
  }
});

export async function GET() {
  const db = adminDb();
  if (!db) return Response.json({ mode: "demo", projects: [] });
  const { data, error } = await db.from("projects").select("*, environments(*)").order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ mode: "database", projects: data });
}

export async function POST(req: Request) {
  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const db = adminDb();
  if (!db) return Response.json({ mode: "demo", project: { id: crypto.randomUUID(), name: body.name, platform: body.platform, targetUrl: body.targetUrl, appPath: body.appPath } });

  const { data: project, error } = await db.from("projects").insert({ name: body.name }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { data: environment, error: envError } = await db.from("environments").insert({
    project_id: project.id,
    name: body.environmentName,
    platform: body.platform,
    base_url: body.platform === "web" ? body.targetUrl : null,
    app_path: body.platform === "windows" ? body.appPath : null,
  }).select().single();
  if (envError) return Response.json({ error: envError.message }, { status: 500 });
  return Response.json({ mode: "database", project, environment });
}
