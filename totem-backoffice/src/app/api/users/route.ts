import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
export const runtime = "nodejs";
const createSchema = z.object({ email: z.email().max(320), displayName: z.string().trim().min(2).max(150), role: z.enum(["admin", "user"]) });
export async function GET() {
  try {
    const auth = await requireUser(true); if (auth.error) return auth.error;
    const r = await getDb().query("SELECT id,email,display_name AS \"displayName\",role FROM users WHERE is_active=true ORDER BY display_name");
    return NextResponse.json({ users: r.rows });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireUser(true); if (auth.error) return auth.error;
    const body = createSchema.parse(await request.json()); const setupToken = randomBytes(32).toString("base64url");
    const temporaryPassword = randomBytes(48).toString("base64url"); const pass = await hashPassword(temporaryPassword);
    const tokenHash = createHash("sha256").update(setupToken).digest("hex");
    const user = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string; email: string; displayName: string; role: string }>(
        "INSERT INTO users(email,display_name,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,display_name AS \"displayName\",role",
        [body.email.trim(), body.displayName, body.role, pass],
      );
      await client.query("INSERT INTO one_time_tokens(user_id,token_hash,expires_at,purpose) VALUES($1,$2,$3,'activation')", [inserted.rows[0].id, tokenHash, new Date(Date.now() + 86400000)]);
      return inserted.rows[0];
    });
    return NextResponse.json({ user, activationUrl: `${new URL(request.url).origin}/activate?token=${setupToken}` }, { status: 201 });
  } catch (error) { return apiError(error); }
}
