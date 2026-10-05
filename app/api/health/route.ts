export const runtime = "nodejs";

export async function GET() {
  const browserbaseApiKey = Boolean(process.env.BROWSERBASE_API_KEY);
  return Response.json({
    name: "TestPilot AI",
    version: "1.2.0",
    status: "ok",
    services: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      planner: Boolean(process.env.OPENAI_API_KEY),
      webRunner: browserbaseApiKey,
      browserbaseProject: Boolean(process.env.BROWSERBASE_PROJECT_ID),
      windowsControlPlane: Boolean(process.env.RUNNER_SHARED_SECRET),
    },
    node: process.version,
  });
}
