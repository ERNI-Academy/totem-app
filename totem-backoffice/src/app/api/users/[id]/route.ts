import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(true); if (auth.error) return auth.error;
    const { id } = await params;
    if (id === auth.user.id) return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    const changed = await withTransaction(async (client) => {
      const result = await client.query("UPDATE users SET is_active=false,updated_at=now() WHERE id=$1 AND is_active=true RETURNING id", [id]);
      if (!result.rowCount) return false;
      await client.query("UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [id]);
      return true;
    });
    if (!changed) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const auth = await requireUser(true); if (auth.error) return auth.error;
    const { id } = await params;
    const body = z.object({ displayName: z.string().trim().min(2).max(150), role: z.enum(["admin", "user"]) }).parse(await request.json());
    const result = await withTransaction(async (client) => {
      const current = await client.query<{ role: string }>("SELECT role FROM users WHERE id=$1 FOR UPDATE", [id]);
      if (!current.rows[0]) return "missing";
      if (current.rows[0].role === "admin" && body.role === "user") {
        const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM users WHERE role='admin' AND is_active=true");
        if (Number(count.rows[0].count) <= 1) return "last-admin";
      }
      await client.query("UPDATE users SET display_name=$1,role=$2,updated_at=now() WHERE id=$3", [body.displayName, body.role, id]);
      return "ok";
    });
    if (result === "missing") return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (result === "last-admin") return NextResponse.json({ error: "The last active administrator cannot be demoted." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
