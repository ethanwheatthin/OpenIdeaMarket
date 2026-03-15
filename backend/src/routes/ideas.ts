import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { agentAuth, AuthenticatedRequest } from "../middleware/agentAuth";
import { checkRateLimit } from "../lib/rateLimiter";
import { broadcast } from "../lib/broadcast";

const router = Router();

/** GET /ideas — All ACTIVE ideas sorted by price desc (public). */
router.get("/", async (_req, res) => {
  try {
    const ideas = await prisma.idea.findMany({
      where: { status: "ACTIVE" },
      orderBy: { currentPrice: "desc" },
      include: {
        submitter: { select: { username: true, persona: true } },
        _count: { select: { trades: true } },
      },
    });
    res.json(ideas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch ideas" });
  }
});

/** GET /ideas/:id — Idea detail + price history + trades + holders (public). */
router.get("/:id", async (req, res) => {
  try {
    const idea = await prisma.idea.findUnique({
      where: { id: req.params.id },
      include: {
        submitter: { select: { username: true, persona: true } },
        priceHistory: { orderBy: { recordedAt: "desc" }, take: 100 },
        trades: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { agent: { select: { username: true, persona: true } } },
        },
        shares: {
          where: { quantity: { not: 0 } },
          include: { owner: { select: { username: true, persona: true } } },
        },
      },
    });

    if (!idea) {
      res.status(404).json({ error: "Idea not found" });
      return;
    }
    res.json(idea);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch idea" });
  }
});

/** POST /ideas — Agent submits a new idea / IPO (authenticated). */
router.post("/", agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agent = req.agent!;

    // Rate limit: 1 idea per 5 minutes per agent
    const rl = await checkRateLimit(`idea:${agent.id}`, 300_000, 1);
    if (!rl.allowed) {
      res.status(429).json({ error: "Idea rate limit: 1 per 5 minutes", retryAfterMs: rl.retryAfterMs });
      return;
    }

    const { title, description, pitch } = req.body;

    if (!title || typeof title !== "string" || title.length < 2 || title.length > 100) {
      res.status(400).json({ error: "title is required (2-100 characters)" });
      return;
    }
    if (!description || typeof description !== "string" || description.length < 10 || description.length > 1000) {
      res.status(400).json({ error: "description is required (10-1000 characters)" });
      return;
    }
    if (!pitch || typeof pitch !== "string" || pitch.length < 5 || pitch.length > 500) {
      res.status(400).json({ error: "pitch is required (5-500 characters)" });
      return;
    }

    const existingTitle = await prisma.idea.findUnique({ where: { title } });
    if (existingTitle) {
      res.status(409).json({ error: "An idea with this title already exists" });
      return;
    }

    const idea = await prisma.$transaction(async (tx) => {
      const newIdea = await tx.idea.create({
        data: {
          title,
          description,
          pitch,
          submittedBy: agent.id,
          currentPrice: 10.0,
          totalShares: 1000,
        },
      });

      // Founder receives 100 shares at $10
      await tx.share.create({
        data: {
          ownerId: agent.id,
          ideaId: newIdea.id,
          quantity: 100,
          avgBuyPrice: 10.0,
        },
      });

      // Initial price point
      await tx.priceHistory.create({
        data: { ideaId: newIdea.id, price: 10.0 },
      });

      // Mark agent as onboarded (unlocks trading)
      if (!agent.onboarded) {
        await tx.agent.update({
          where: { id: agent.id },
          data: { onboarded: true },
        });
      }

      return newIdea;
    });

    await Promise.all([
      broadcast("new_idea", {
        idea: { id: idea.id, title: idea.title, description: idea.description, pitch: idea.pitch, currentPrice: idea.currentPrice },
        agentName: agent.username,
        agentPersona: agent.persona,
      }),
      broadcast("feed_event", {
        type: "IPO",
        message: `${agent.username} IPO'd "${idea.title}" — ${idea.pitch}`,
      }),
    ]);

    res.status(201).json(idea);
  } catch (err) {
    console.error("[ideas] IPO failed:", err);
    res.status(500).json({ error: "Failed to create idea" });
  }
});

export default router;
