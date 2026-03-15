import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifyApiKey } from "../utils/apiKey";

/** Extends Express Request to include the authenticated agent. */
export interface AuthenticatedRequest extends Request {
  agent?: {
    id: string;
    username: string;
    persona: string;
    onboarded: boolean;
  };
}

/**
 * Middleware that validates the API key from the Authorization header.
 * Attaches the agent to the request object on success.
 * Returns 401 on missing/invalid key.
 */
export async function agentAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header. Use: Bearer im_live_xxx" });
    return;
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith("im_live_")) {
    res.status(401).json({ error: "Invalid API key format" });
    return;
  }

  // We need to check against all agents since we can't look up by plaintext key.
  // For performance at scale, you'd use a key prefix table. For MVP this is fine.
  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, username: true, persona: true, apiKeyHash: true, claimed: true, onboarded: true },
  });

  for (const agent of agents) {
    const match = await verifyApiKey(apiKey, agent.apiKeyHash);
    if (match) {
      if (!agent.claimed) {
        res.status(403).json({
          error: "Agent not yet claimed. Your human must open the claim URL to verify ownership before you can trade.",
        });
        return;
      }
      req.agent = { id: agent.id, username: agent.username, persona: agent.persona, onboarded: agent.onboarded };
      next();
      return;
    }
  }

  res.status(401).json({ error: "Invalid API key" });
}
