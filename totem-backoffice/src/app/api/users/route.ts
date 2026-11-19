import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { issueActivationLink } from "@/lib/activationToken";

export const runtime = "nodejs";
const createSchema = z.object({ email: z.email().max(320), displayName: z.string().trim().min(2).max(150), role: z.enum(["admin", "user"]) });
const privateResponse = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const auth = await requireUser(true);
    if (auth.error) return auth.error;
    const result = await getDb().query(
      'SELECT id, email, display_name AS "displayName", role FROM users WHERE is_active=true ORDER BY display_name',
    );
    return NextResponse.json({ users: result.rows }, { headers: privateResponse });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(true);
    if (auth.error) return auth.error;
    const body = createSchema.parse(await request.json());
    const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
    const created = await withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        'INSERT INTO users(email,display_name,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,display_name AS "displayName",role',
        [body.email.trim(), body.displayName, body.role, passwordHash],
      );
      const user = result.rows[0];
      return { user, ...await issueActivationLink(client, user.id, request) };
    });
    return NextResponse.json(created, { status: 201, headers: privateResponse });
  } catch (error) { return apiError(error); }
}
