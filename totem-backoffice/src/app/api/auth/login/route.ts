import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
export const runtime = "nodejs";
const schema = z.object({ email: z.email().max(320), password: z.string().min(1).max(128) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json()); const pool = await getDb();
    const result = await pool.request().input("email", sql.NVarChar(320), body.email.trim()).query<{ id: string; passwordHash: string }>("SELECT Id AS id,PasswordHash AS passwordHash FROM dbo.Users WHERE EmailNormalized=UPPER(LTRIM(RTRIM(@email))) AND IsActive=1");
    const user = result.recordset[0];
    if (!user || !(await verifyPassword(body.password, user.passwordHash).catch(() => false))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    await createSession(user.id); return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
