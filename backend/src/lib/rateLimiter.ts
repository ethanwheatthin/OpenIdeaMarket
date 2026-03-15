import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return redis;
}

/**
 * Check and enforce a rate limit. Returns true if the request is allowed.
 * Uses Redis INCR + EXPIRE for multi-instance safe rate limiting.
 *
 * @param key     Unique key for this rate limit (e.g., "trade:agentId")
 * @param windowMs  Time window in milliseconds
 * @param maxHits   Maximum allowed hits within the window
 */
export async function checkRateLimit(
  key: string,
  windowMs: number,
  maxHits: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const r = getRedis();
  const redisKey = `ratelimit:${key}`;

  const count = await r.incr(redisKey);
  if (count === 1) {
    await r.pexpire(redisKey, windowMs);
  }

  if (count > maxHits) {
    const ttl = await r.pttl(redisKey);
    return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
  }

  return { allowed: true, retryAfterMs: 0 };
}
