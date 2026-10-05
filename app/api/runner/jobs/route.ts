import { z } from "zod";
export const runtime="nodejs";
const Action=z.object({type:z.enum(["OBSERVE","FIND","CLICK","TYPE","SELECT","SCROLL","WAIT","UPLOAD","NAVIGATE","CAPTURE","VERIFY"]),target:z.string().optional(),value:z.string().optional()});
export async function POST(req:Request){if(!process.env.RUNNER_SHARED_SECRET||req.headers.get("x-runner-secret")!==process.env.RUNNER_SHARED_SECRET)return new Response("Unauthorized",{status:401});const payload=z.object({runId:z.string(),platform:z.enum(["web","windows"]),steps:z.array(Action)}).parse(await req.json());return Response.json({accepted:true,...payload,note:"TestPilot external runner contract. Reserved for self-hosted Web Runner / V1.2 Windows Agent."})}
