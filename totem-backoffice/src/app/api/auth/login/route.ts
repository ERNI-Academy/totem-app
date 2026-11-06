import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
export const runtime = "nodejs";
const schema = z.object({ email: z.email().max(320), password: z.string().min(1).max(128) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await getDb().query<{ id: string; passwordHash: string }>(
      "SELECT id, password_hash AS \"passwordHash\" FROM users WHERE upper(btrim(email))=upper(btrim($1)) AND is_active=true",
      [body.email.trim()],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(body.password, user.passwordHash).catch(() => false))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    await createSession(user.id); return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
