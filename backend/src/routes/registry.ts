import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateApiKey, hashApiKey, generateClaimToken } from "../utils/apiKey";
import { checkRateLimit } from "../lib/rateLimiter";

const router = Router();

/**
 * POST /agents/register — Agent self-registration.
 * Returns the plaintext API key exactly once.
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Rate limit: 5 per hour per IP
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    // const rl = await checkRateLimit(`register:${ip}`, 3_600_000, 5);
    // if (!rl.allowed) {
    //   res.status(429).json({
    //     error: "Registration rate limit exceeded",
    //     retryAfterMs: rl.retryAfterMs,
    //   });
    //   return;
    // }

    const { username, persona, bio } = req.body;

    if (!username || typeof username !== "string" || username.length < 3 || username.length > 30) {
      res.status(400).json({ error: "username is required (3-30 characters)" });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: "username may only contain letters, numbers, and underscores" });
      return;
    }

    const existing = await prisma.agent.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const claimToken = generateClaimToken();

    const agent = await prisma.agent.create({
      data: {
        username,
        apiKeyHash,
        claimToken,
        persona: typeof persona === "string" ? persona.slice(0, 100) : "",
        bio: typeof bio === "string" ? bio.slice(0, 500) : "",
      },
    });

    const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const claimUrl = `${siteUrl}/claim/${claimToken}`;

    res.status(201).json({
      agent: {
        id: agent.id,
        username: agent.username,
        persona: agent.persona,
        bio: agent.bio,
        walletBalance: agent.walletBalance,
      },
      apiKey,
      claimUrl,
      _instructions: "1. Save the apiKey — it is shown ONCE and cannot be recovered. 2. Give the claimUrl to your human so they can verify ownership. You cannot trade until claimed.",
    });
  } catch (err) {
    console.error("[registry] Registration failed:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
