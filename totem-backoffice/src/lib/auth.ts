import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { getDb, sql } from "./db";
import type { AppUser } from "@/types/content";

const COOKIE = "totem_session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function signature(id: string) {
  const secret = getEnv().AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(id).digest("hex");
}
export async function createSession(userId: string) {
  const pool = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await pool.request().input("user", sql.UniqueIdentifier, userId).input("hash", sql.Char(64), hash(token)).input("expires", sql.DateTime2, expires)
    .query("INSERT dbo.UserSessions(UserId,TokenHash,ExpiresAt) VALUES(@user,@hash,@expires)");
  const jar = await cookies();
  jar.set(COOKIE, `${token}.${signature(token)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}
export async function destroySession() {
  const jar = await cookies(); const raw = jar.get(COOKIE)?.value;
  if (raw) {
    const token = raw.split(".")[0];
    if (token) { const pool = await getDb(); await pool.request().input("hash", sql.Char(64), hash(token)).query("UPDATE dbo.UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE TokenHash=@hash AND RevokedAt IS NULL"); }
  }
  jar.delete(COOKIE);
}
export async function getCurrentUser(): Promise<AppUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [token, provided] = raw.split(".");
  if (!token || !provided) return null;
  const expected = signature(token);
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const pool = await getDb();
  const result = await pool.request().input("hash", sql.Char(64), hash(token)).query<AppUser>(
    "SELECT u.Id AS id,u.Email AS email,u.DisplayName AS displayName,u.Role AS role FROM dbo.UserSessions s JOIN dbo.Users u ON u.Id=s.UserId WHERE s.TokenHash=@hash AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() AND u.IsActive=1"
  );
  return result.recordset[0] ?? null;
}
export async function requireUser(adminOnly = false) {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Authentication required." }, { status: 401 }) } as const;
  if (adminOnly && user.role !== "admin") return { error: Response.json({ error: "Administrator access required." }, { status: 403 }) } as const;
  return { user } as const;
}
export function passwordHash(value: string) { return hash(value); }
