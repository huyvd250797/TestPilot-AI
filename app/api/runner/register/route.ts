import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
export const runtime = "nodejs";

const Body = z.object({
  runnerId: z.string().uuid(),
  name: z.string().min(1),
  machineName: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  if (!isRunnerAuthorized(req)) return runnerUnauthorized();
  const body = Body.parse(await req.json());
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase is required for Windows Runner." }, { status: 503 });
  const row = {
    id: body.runnerId,
    name: body.name,
    machine_name: body.machineName,
    platform: "windows",
    version: body.version,
    capabilities: body.capabilities,
    status: "ONLINE",
    last_heartbeat_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("runner_agents").upsert(row).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ runner: data });
}
