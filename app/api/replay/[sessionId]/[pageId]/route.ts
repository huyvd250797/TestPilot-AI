export const runtime = "nodejs";
export async function GET(_: Request, ctx: { params: Promise<{ sessionId: string; pageId: string }> }) {
  const { sessionId, pageId } = await ctx.params;
  if (!process.env.BROWSERBASE_API_KEY) return new Response("Browserbase not configured", { status: 503 });
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}/replays/${encodeURIComponent(pageId)}`, { headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY } });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/vnd.apple.mpegurl", "cache-control": "private, max-age=60" } });
}
