import { ZodError } from "zod";
import { NextResponse } from "next/server";
export function apiError(error: unknown) {
  if(error instanceof ZodError)return NextResponse.json({error:"Invalid request.",issues:error.issues.map(({path,message})=>({path,message}))},{status:400});
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("not configured") ? 503 : 500;
  if (status === 500) console.error("API request failed", error);
  return NextResponse.json({ error: status === 503 ? message : "The request could not be completed." }, { status });
}
export async function readJson<T>(request: Request): Promise<T> {
  const size = Number(request.headers.get("content-length") || "0");
  if (size > 2_000_000) throw new Error("Request body is too large.");
  return await request.json() as T;
}
