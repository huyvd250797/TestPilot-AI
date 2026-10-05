export const runtime = "nodejs";

export async function GET() {
  const browserbaseApiKey = Boolean(process.env.BROWSERBASE_API_KEY);
  return Response.json({
    name: "TestPilot AI",
    version: "1.1.1",
    status: "ok",
    services: {
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      planner: Boolean(process.env.OPENAI_API_KEY),
      webRunner: browserbaseApiKey,
      browserbaseProject: Boolean(process.env.BROWSERBASE_PROJECT_ID),
    },
    node: process.version,
  });
}
