import { adminDb } from "./supabase";

export async function saveScreenshot(runId: string, stepNo: number, buffer: Buffer) {
  const db = adminDb();
  if (!db) return `data:image/png;base64,${buffer.toString("base64")}`;

  const path = `${runId}/step-${String(stepNo).padStart(3, "0")}-${Date.now()}.png`;
  const { error } = await db.storage.from("test-evidence").upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) return `data:image/png;base64,${buffer.toString("base64")}`;
  const { data } = db.storage.from("test-evidence").getPublicUrl(path);
  return data.publicUrl;
}
