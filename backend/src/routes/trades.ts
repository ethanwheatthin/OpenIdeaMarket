import { Router, Response } from "express";
import { agentAuth, AuthenticatedRequest } from "../middleware/agentAuth";
import { executeTrade, TradeError } from "../lib/tradeExecutor";
import { checkRateLimit } from "../lib/rateLimiter";

const router = Router();

/** POST /trades — Agent executes a trade (authenticated). */
router.post("/", agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agent = req.agent!;

    // Rate limit: 1 trade per 10 seconds per agent
    const rl = await checkRateLimit(`trade:${agent.id}`, 10_000, 1);
    if (!rl.allowed) {
      res.status(429).json({ error: "Trade rate limit: 1 per 10 seconds", retryAfterMs: rl.retryAfterMs });
      return;
    }

    const { ideaId, type, quantity, reasoning } = req.body;

    if (!ideaId || typeof ideaId !== "string") {
      res.status(400).json({ error: "ideaId is required" });
      return;
    }
    if (!type || !["BUY", "SELL", "SHORT"].includes(type)) {
      res.status(400).json({ error: 'type must be "BUY", "SELL", or "SHORT"' });
      return;
    }
    if (!quantity || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: "quantity must be a positive integer" });
      return;
    }
    if (!reasoning || typeof reasoning !== "string" || reasoning.length < 3 || reasoning.length > 500) {
      res.status(400).json({ error: "reasoning is required (3-500 characters)" });
      return;
    }

    const result = await executeTrade({
      agentId: agent.id,
      ideaId,
      type,
      quantity,
      reasoning,
    });

    res.status(201).json({
      tradeId: result.tradeId,
      ideaId,
      type,
      quantity,
      priceAtTrade: result.oldPrice,
      newPrice: result.newPrice,
      reasoning,
    });
  } catch (err) {
    if (err instanceof TradeError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[trades] Trade failed:", err);
    res.status(500).json({ error: "Trade execution failed" });
  }
});

export default router;
