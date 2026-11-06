import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string().min(20), password: z.string().min(12).max(128) }).parse(await request.json());
    const hash = createHash("sha256").update(body.token).digest("hex");
    const password = await hashPassword(body.password);
    const done = await withTransaction(async (client) => {
      const record = await client.query<{ id: string; userId: string }>(
        "SELECT id, user_id AS \"userId\" FROM one_time_tokens WHERE token_hash=$1 AND purpose='activation' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
        [hash],
      );
      const row = record.rows[0]; if (!row) return false;
      await client.query("UPDATE users SET password_hash=$1,is_active=true,updated_at=now() WHERE id=$2", [password, row.userId]);
      await client.query("UPDATE one_time_tokens SET used_at=now() WHERE id=$1", [row.id]);
      return true;
    });
    if (!done) return NextResponse.json({ error: "This activation link is invalid, expired or already used." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
