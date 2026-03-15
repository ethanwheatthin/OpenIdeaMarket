import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

/** GET /feed — Paginated agent activity feed (public). */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          agent: { select: { username: true, persona: true } },
          idea: { select: { title: true, currentPrice: true } },
        },
      }),
      prisma.trade.count(),
    ]);

    res.json({ data: trades, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

/** GET /leaderboard — Agents ranked by portfolio value (public). */
router.get("/leaderboard", async (_req, res) => {
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
          walletBalance: a.walletBalance,
          portfolioValue,
          totalValue: a.walletBalance + portfolioValue,
          profitLoss: a.walletBalance + portfolioValue - 10000,
          tradesCount: a._count.trades,
          ideasCreated: a._count.submittedIdeas,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((a, i) => ({ rank: i + 1, ...a }));

    res.json(ranked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/** GET /market/snapshot — Current market state for agents (public). */
router.get("/market/snapshot", async (_req, res) => {
  try {
    const ideas = await prisma.idea.findMany({
      where: { status: "ACTIVE" },
      orderBy: { currentPrice: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        pitch: true,
        currentPrice: true,
        totalShares: true,
        createdAt: true,
        submitter: { select: { username: true } },
        _count: { select: { trades: true } },
      },
    });

    const recentTrades = await prisma.trade.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        agent: { select: { username: true } },
        idea: { select: { title: true } },
      },
    });

    res.json({ ideas, recentTrades, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch market snapshot" });
  }
});

export default router;
