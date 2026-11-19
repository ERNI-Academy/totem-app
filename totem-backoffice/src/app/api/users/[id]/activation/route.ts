import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, withTransaction, type DbClient } from "@/lib/db";
import { apiError } from "@/lib/http";
import { issueActivationLink, pendingActivation, readActivationLink } from "@/lib/activationToken";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };

async function readStatus(client: DbClient, id: string, request: Request) {
  const { rows: [user] } = await client.query<{ pending: boolean; ciphertext: string | null; expiresAt: Date | null }>(
    `SELECT (${pendingActivation}) AS pending, t.token_ciphertext AS ciphertext, t.expires_at AS "expiresAt"
     FROM users u LEFT JOIN LATERAL (
       SELECT token_ciphertext, expires_at FROM one_time_tokens
       WHERE user_id=u.id AND purpose='activation' AND used_at IS NULL AND expires_at>clock_timestamp()
       ORDER BY created_at DESC LIMIT 1
     ) t ON true WHERE u.id=$1 AND u.is_active`,
    [id],
  );
  if (!user) return null;
  const activationUrl = user.pending ? readActivationLink(user.ciphertext, request) : null;
  return { pending: user.pending, activationUrl, expiresAt: activationUrl ? user.expiresAt : null };
}

export async function GET(request: Request, { params }: Context) {
  try {
    const auth = await requireUser(true);
    if (auth.error) return auth.error;
    const id = z.uuid().parse((await params).id);
    const status = await readStatus(getDb(), id, request);
    return status ? NextResponse.json(status, { headers }) : NextResponse.json({ error: "User not found." }, { status: 404, headers });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const auth = await requireUser(true);
    if (auth.error) return auth.error;
    const id = z.uuid().parse((await params).id);
    const status = await withTransaction(async client => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [id]);
      const current = await readStatus(client, id, request);
      if (!current?.pending || current.activationUrl) return current;
      await client.query(
        "UPDATE one_time_tokens SET expires_at=LEAST(expires_at,clock_timestamp()), token_ciphertext=NULL WHERE user_id=$1 AND purpose='activation' AND used_at IS NULL",
        [id],
      );
      return { pending: true, ...await issueActivationLink(client, id, request) };
    });
    return status ? NextResponse.json(status, { headers }) : NextResponse.json({ error: "User not found." }, { status: 404, headers });
  } catch (error) { return apiError(error); }
}
