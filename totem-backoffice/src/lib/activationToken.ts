import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "./env";
import type { DbClient } from "./db";

function key() {
  const secret = getEnv().AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required to manage activation links.");
  return createHash("sha256").update(secret).digest();
}

export function encryptActivationToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}

export function decryptActivationToken(value: string) {
  const [iv, tag, ciphertext] = value.split(".").map(part => Buffer.from(part, "base64url"));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !ciphertext) throw new Error("Invalid activation token record.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}


export const pendingActivation = `
  u.activation_required OR (
  EXISTS (SELECT 1 FROM one_time_tokens WHERE user_id=u.id AND purpose='activation')
  AND NOT EXISTS (SELECT 1 FROM one_time_tokens WHERE user_id=u.id AND purpose='activation' AND used_at IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM user_sessions WHERE user_id=u.id)
  )
`;

export async function issueActivationLink(client: DbClient, userId: string, request: Request) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const encrypted = encryptActivationToken(token);
  const result = await client.query<{ expiresAt: Date }>(
    `INSERT INTO one_time_tokens(user_id, token_hash, purpose, expires_at, token_ciphertext)
     VALUES($1, $2, 'activation', now() + interval '24 hours', $3)
     RETURNING expires_at AS "expiresAt"`,
    [userId, hash, encrypted],
  );
  return { activationUrl: new URL("/activate?token=" + token, request.url).href, expiresAt: result.rows[0].expiresAt };
}

export function readActivationLink(encrypted: string | null, request: Request) {
  if (!encrypted) return null;
  try {
    return new URL("/activate?token=" + decryptActivationToken(encrypted), request.url).href;
  } catch {
    // A link from an old encryption key can be replaced from the user details.
    return null;
  }
}
