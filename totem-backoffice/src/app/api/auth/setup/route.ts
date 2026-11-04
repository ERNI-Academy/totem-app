import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
const schema = z.object({ key: z.string().min(24), email: z.email().max(320), displayName: z.string().trim().min(2).max(150), password: z.string().min(12).max(128) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const setupKey = getEnv().INITIAL_ADMIN_SETUP_KEY;
    if (!setupKey) return NextResponse.json({ error: "Admin setup is disabled." }, { status: 404 });
    const provided = createHash("sha256").update(body.key).digest(); const expected = createHash("sha256").update(setupKey).digest();
    if (!timingSafeEqual(provided, expected)) return NextResponse.json({ error: "Invalid setup key." }, { status: 403 });
    const pool = await getDb();
    const tx = new sql.Transaction(pool); await tx.begin();
    try {
      const count = await new sql.Request(tx).query<{ count: number }>("SELECT COUNT(*) AS count FROM dbo.Users");
      if (count.recordset[0].count !== 0) { await tx.rollback(); return NextResponse.json({ error: "Setup has already been completed." }, { status: 409 }); }
      const pass = await hashPassword(body.password);
      const user = await new sql.Request(tx).input("email", sql.NVarChar(320), body.email.trim()).input("name", sql.NVarChar(150), body.displayName).input("password", sql.NVarChar(300), pass)
        .query<{ id: string }>("INSERT dbo.Users(Email,DisplayName,Role,PasswordHash) OUTPUT inserted.Id AS id VALUES(@email,@name,'admin',@password)");
      await tx.commit(); await createSession(user.recordset[0].id);
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (error) { await tx.rollback(); throw error; }
  } catch (error) { return apiError(error); }
}
