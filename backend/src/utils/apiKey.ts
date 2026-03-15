import crypto from "crypto";
import bcrypt from "bcrypt";

const PREFIX = "im_live_";
const SALT_ROUNDS = parseInt(process.env.API_KEY_SALT_ROUNDS || "10", 10);

/** Generate a new API key with the im_live_ prefix + 32 hex chars. */
export function generateApiKey(): string {
  return PREFIX + crypto.randomBytes(16).toString("hex");
}

/** Generate a random claim token for the human verification URL. */
export function generateClaimToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Hash an API key for storage. */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, SALT_ROUNDS);
}

/** Compare a plaintext API key against a stored hash. */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
