import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(24).optional(),
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
  INITIAL_ADMIN_SETUP_KEY: z.string().min(24).optional(),
  AZURE_STORAGE_CONNECTION_STRING: z.string().min(1).optional(),
  AZURE_STORAGE_CONTAINER: z.string().regex(/^[a-z0-9-]{3,63}$/).optional(),
  APP_ENV: z.enum(["local", "production", "preview"]).default("local"),
});
let cached: z.infer<typeof schema> | undefined;
export function getEnv() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function getMediaEnvironment(): "development" | "production" {
  return getEnv().APP_ENV === "production" ? "production" : "development";
}
