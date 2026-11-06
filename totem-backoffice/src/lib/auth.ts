import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { getEnv } from "./env";

const COOKIE = "totem_session";
const SESSION_DAYS = 14;
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)", [userId, hash(token), expires]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) await getDb().query("UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [hash(token)]);
  jar.delete(COOKIE);
}

export type CurrentUser = { id: string; email: string; displayName: string; role: "admin" | "user" };
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const result = await getDb().query<CurrentUser>(
    "SELECT u.id, u.email, u.display_name AS \"displayName\", u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.is_active=true",
    [hash(token)],
  );
  return result.rows[0] ?? null;
}

export async function requireUser(adminOnly = false) {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Authentication required." }, { status: 401 }) } as const;
  if (adminOnly && user.role !== "admin") return { error: Response.json({ error: "Administrator access required." }, { status: 403 }) } as const;
  return { user } as const;
}

export function setupEnabled() { return Boolean(getEnv().INITIAL_ADMIN_SETUP_KEY); }
