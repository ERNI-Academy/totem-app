import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiError } from "@/lib/http";
import { pendingActivation } from "@/lib/activationToken";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string().min(20), password: z.string().min(12).max(128) }).parse(await request.json());
    const hash = createHash("sha256").update(body.token).digest("hex");
    const password = await hashPassword(body.password);
    const done = await withTransaction(async (client) => {
      const account = await client.query<{ id: string }>(
        `SELECT u.id FROM users u JOIN one_time_tokens t ON t.user_id=u.id
         WHERE t.token_hash=$1 AND t.purpose='activation' AND u.is_active FOR UPDATE OF u`,
        [hash],
      );
      const user = account.rows[0];
      if (!user) return false;
      const used = await client.query(
        `UPDATE one_time_tokens SET used_at=now(),token_ciphertext=NULL
         WHERE token_hash=$1 AND used_at IS NULL AND expires_at>clock_timestamp()
           AND EXISTS (SELECT 1 FROM users u WHERE u.id=$2 AND (${pendingActivation}))`,
        [hash, user.id],
      );
      if (!used.rowCount) return false;
      await client.query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2", [password, user.id]);
      return true;
    });
    if (!done) return NextResponse.json({ error: "This activation link is invalid, expired or already used." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
