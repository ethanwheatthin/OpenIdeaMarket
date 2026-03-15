import { TradeType } from "@prisma/client";
import { prisma } from "./prisma";
import { updatePrice } from "./pricingEngine";
import { broadcast } from "./broadcast";

interface TradeRequest {
  agentId: string;
  ideaId: string;
  type: TradeType;
  quantity: number;
  reasoning: string;
}

interface TradeResult {
  tradeId: string;
  newPrice: number;
  oldPrice: number;
}

/**
 * Validate and execute a trade atomically within a Prisma transaction.
 * Broadcasts price_update and agent_activity events on success.
 * Throws on validation failure with descriptive messages.
 */
export async function executeTrade(req: TradeRequest): Promise<TradeResult> {
  const { agentId, ideaId, type, quantity, reasoning } = req;

  if (quantity < 1 || quantity > 500) {
    throw new TradeError("Quantity must be between 1 and 500", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findUniqueOrThrow({ where: { id: agentId } });
    const idea = await tx.idea.findUnique({
      where: { id: ideaId },
      include: { submitter: { select: { username: true } } },
    });

    if (!idea || idea.status !== "ACTIVE") {
      throw new TradeError("Idea not found or not active", 404);
    }

    // Anti-manipulation: no trading own idea within 60s of IPO
    if (idea.submittedBy === agentId) {
      const elapsed = Date.now() - idea.createdAt.getTime();
      if (elapsed < 60_000) {
        throw new TradeError("Cannot trade your own idea within 60 seconds of IPO", 403);
      }
    }

    if (type === "BUY") {
      const cost = idea.currentPrice * quantity;
      if (agent.walletBalance < cost) {
        throw new TradeError(
          `Insufficient balance: need $${cost.toFixed(2)}, have $${agent.walletBalance.toFixed(2)}`,
          400
        );
      }

      await tx.agent.update({
        where: { id: agentId },
        data: { walletBalance: { decrement: cost } },
      });

      const existing = await tx.share.findUnique({
        where: { ownerId_ideaId: { ownerId: agentId, ideaId } },
      });

      if (existing) {
        const totalQty = existing.quantity + quantity;
        const newAvg =
          (existing.avgBuyPrice * existing.quantity + idea.currentPrice * quantity) / totalQty;
        await tx.share.update({
          where: { id: existing.id },
          data: { quantity: totalQty, avgBuyPrice: newAvg },
        });
      } else {
        await tx.share.create({
          data: { ownerId: agentId, ideaId, quantity, avgBuyPrice: idea.currentPrice },
        });
      }
    } else if (type === "SELL") {
      const holding = await tx.share.findUnique({
        where: { ownerId_ideaId: { ownerId: agentId, ideaId } },
      });

      if (!holding || holding.quantity < quantity) {
        throw new TradeError(
          `Insufficient shares: need ${quantity}, have ${holding?.quantity ?? 0}`,
          400
        );
      }

      const revenue = idea.currentPrice * quantity;
      await tx.agent.update({
        where: { id: agentId },
        data: { walletBalance: { increment: revenue } },
      });

      const newQty = holding.quantity - quantity;
      if (newQty === 0) {
        await tx.share.delete({ where: { id: holding.id } });
      } else {
        await tx.share.update({
          where: { id: holding.id },
          data: { quantity: newQty },
        });
      }
    } else if (type === "SHORT") {
      // SHORT: borrow and sell shares, creating a negative position
      // Agent is credited the current price * quantity
      const credit = idea.currentPrice * quantity;
      await tx.agent.update({
        where: { id: agentId },
        data: { walletBalance: { increment: credit } },
      });

      const existing = await tx.share.findUnique({
        where: { ownerId_ideaId: { ownerId: agentId, ideaId } },
      });

      if (existing) {
        await tx.share.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity - quantity },
        });
      } else {
        await tx.share.create({
          data: { ownerId: agentId, ideaId, quantity: -quantity, avgBuyPrice: idea.currentPrice },
        });
      }
    }

    const trade = await tx.trade.create({
      data: {
        agentId,
        ideaId,
        type,
        quantity,
        priceAtTrade: idea.currentPrice,
        reasoning,
      },
    });

    const { newPrice, oldPrice } = await updatePrice(tx, ideaId, type, quantity);

    return {
      tradeId: trade.id,
      newPrice,
      oldPrice,
      ideaTitle: idea.title,
      agentName: agent.username,
      agentPersona: agent.persona,
    };
  });

  // Broadcast events outside the transaction
  await Promise.all([
    broadcast("price_update", {
      ideaId,
      ideaTitle: result.ideaTitle,
      newPrice: result.newPrice,
      oldPrice: result.oldPrice,
      changePct: (((result.newPrice - result.oldPrice) / result.oldPrice) * 100).toFixed(2),
    }),
    broadcast("agent_activity", {
      agentName: result.agentName,
      agentPersona: result.agentPersona,
      action: type,
      ideaTitle: result.ideaTitle,
      ideaId,
      quantity,
      reasoning,
    }),
    broadcast("trade_executed", {
      tradeId: result.tradeId,
      agentId,
      ideaId,
      type,
      quantity,
      price: result.newPrice,
    }),
  ]);

  return { tradeId: result.tradeId, newPrice: result.newPrice, oldPrice: result.oldPrice };
}

export class TradeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TradeError";
    this.status = status;
  }
}
