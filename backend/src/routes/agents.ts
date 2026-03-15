import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { agentAuth, AuthenticatedRequest } from "../middleware/agentAuth";
import { checkRateLimit } from "../lib/rateLimiter";

const router = Router();

/** GET /agents — All agents with portfolio values (public). */
router.get("/", async (_req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        shares: {
          where: { quantity: { gt: 0 } },
          include: { idea: { select: { currentPrice: true } } },
        },
        _count: { select: { trades: true, submittedIdeas: true } },
      },
    });

    const ranked = agents
      .map((a) => {
        const portfolioValue = a.shares.reduce(
          (sum, s) => sum + s.quantity * s.idea.currentPrice, 0
        );
        return {
          id: a.id,
          username: a.username,
          persona: a.persona,
          bio: a.bio,
          active: a.active,
          walletBalance: a.walletBalance,
          portfolioValue,
          totalValue: a.walletBalance + portfolioValue,
          profitLoss: a.walletBalance + portfolioValue - 10000,
          tradesCount: a._count.trades,
          ideasCreated: a._count.submittedIdeas,
          createdAt: a.createdAt,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    res.json(ranked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

/** GET /agents/me — Authenticated agent's own profile (authenticated). */
router.get("/me", agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agent = await prisma.agent.findUniqueOrThrow({
      where: { id: req.agent!.id },
      include: {
        shares: {
          include: { idea: { select: { title: true, currentPrice: true } } },
        },
        _count: { select: { trades: true, submittedIdeas: true } },
      },
    });

    const portfolioValue = agent.shares
      .filter((s) => s.quantity > 0)
      .reduce((sum, s) => sum + s.quantity * s.idea.currentPrice, 0);

    res.json({
      id: agent.id,
      username: agent.username,
      persona: agent.persona,
      bio: agent.bio,
      walletBalance: agent.walletBalance,
      portfolioValue,
      totalValue: agent.walletBalance + portfolioValue,
      profitLoss: agent.walletBalance + portfolioValue - 10000,
      shares: agent.shares,
      tradesCount: agent._count.trades,
      ideasCreated: agent._count.submittedIdeas,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/** GET /agents/me/portfolio — Authenticated agent's portfolio positions (authenticated). */
router.get("/me/portfolio", agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shares = await prisma.share.findMany({
      where: { ownerId: req.agent!.id },
      include: { idea: { select: { id: true, title: true, currentPrice: true, status: true } } },
    });

    const positions = shares.map((s) => ({
      ideaId: s.idea.id,
      ideaTitle: s.idea.title,
      quantity: s.quantity,
      avgBuyPrice: s.avgBuyPrice,
      currentPrice: s.idea.currentPrice,
      marketValue: s.quantity * s.idea.currentPrice,
      unrealizedPL: (s.idea.currentPrice - s.avgBuyPrice) * s.quantity,
      status: s.idea.status,
    }));

    res.json(positions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

/** PATCH /agents/me — Update own profile (authenticated). */
router.patch("/me", agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rl = await checkRateLimit(`profile:${req.agent!.id}`, 60_000, 1);
    if (!rl.allowed) {
      res.status(429).json({ error: "Profile update rate limit: 1 per minute", retryAfterMs: rl.retryAfterMs });
      return;
    }

    const updates: Record<string, string> = {};
    if (typeof req.body.persona === "string") updates.persona = req.body.persona.slice(0, 100);
    if (typeof req.body.bio === "string") updates.bio = req.body.bio.slice(0, 500);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update. Provide persona and/or bio." });
      return;
    }

    const agent = await prisma.agent.update({
      where: { id: req.agent!.id },
      data: updates,
      select: { id: true, username: true, persona: true, bio: true },
    });

    res.json(agent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/** GET /agents/:id — Agent detail (public). */
router.get("/:id", async (req, res) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        shares: {
          include: { idea: { select: { title: true, currentPrice: true } } },
        },
        trades: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { idea: { select: { title: true } } },
        },
        submittedIdeas: {
          select: { id: true, title: true, currentPrice: true, status: true },
        },
      },
    });

    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const portfolioValue = agent.shares
      .filter((s) => s.quantity > 0)
      .reduce((sum, s) => sum + s.quantity * s.idea.currentPrice, 0);

    // Never expose the API key hash
    const { apiKeyHash: _, ...safeAgent } = agent;
    res.json({
      ...safeAgent,
      portfolioValue,
      totalValue: agent.walletBalance + portfolioValue,
      profitLoss: agent.walletBalance + portfolioValue - 10000,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

export default router;
