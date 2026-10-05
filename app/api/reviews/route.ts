import { z } from "zod";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";
const Body = z.object({ runId: z.string().uuid(), verdict: z.enum(["APPROVED","NEEDS_CHANGE","INVALID_TEST"]), reason: z.string().optional(), comment: z.string().optional() });
export async function POST(req: Request){const body=Body.parse(await req.json());const db=adminDb();if(!db)return Response.json({error:"Supabase is not configured."},{status:503});const {data,error}=await db.from("test_reviews").insert({run_id:body.runId,verdict:body.verdict,reason:body.reason||null,comment:body.comment||null}).select().single();if(error)return Response.json({error:error.message},{status:500});return Response.json({review:data})}
