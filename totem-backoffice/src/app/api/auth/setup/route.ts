import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb, withTransaction } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { apiError } from "@/lib/http";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
const schema = z.object({ key: z.string().min(24), email: z.email().max(320), displayName: z.string().trim().min(2).max(150), password: z.string().min(12).max(128) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json()); const setupKey = getEnv().INITIAL_ADMIN_SETUP_KEY;
    if (!setupKey) return NextResponse.json({ error: "Admin setup is disabled." }, { status: 404 });
    const provided = createHash("sha256").update(body.key).digest(); const expected = createHash("sha256").update(setupKey).digest();
    if (!timingSafeEqual(provided, expected)) return NextResponse.json({ error: "Invalid setup key." }, { status: 403 });
    const userId = await withTransaction(async (client) => {
      const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
      if (Number(count.rows[0].count) !== 0) throw new Error("Setup has already been completed.");
      const pass = await hashPassword(body.password);
      const user = await client.query<{ id: string }>(
        "INSERT INTO users(email,display_name,role,password_hash) VALUES($1,$2,'admin',$3) RETURNING id",
        [body.email.trim(), body.displayName, pass],
      );
      return user.rows[0].id;
    });
    await createSession(userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return apiError(error); }
}
