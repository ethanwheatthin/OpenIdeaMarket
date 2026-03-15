import { TradeType, PrismaClient } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const PRICE_FLOOR = 0.01;
const IMPACT_FACTOR = 0.1;

/**
 * Recalculate and persist the price of an idea after a trade.
 * Must be called within a Prisma transaction.
 * Returns the new price.
 */
export async function updatePrice(
  tx: TxClient,
  ideaId: string,
  tradeType: TradeType,
  quantity: number
): Promise<{ newPrice: number; oldPrice: number }> {
  const idea = await tx.idea.findUniqueOrThrow({ where: { id: ideaId } });
  const oldPrice = idea.currentPrice;

  const buyVolume = tradeType === "BUY" ? quantity : 0;
  const sellVolume = tradeType === "SELL" || tradeType === "SHORT" ? quantity : 0;

  const priceDelta = ((buyVolume - sellVolume) / idea.totalShares) * IMPACT_FACTOR;
  const rawPrice = idea.currentPrice * (1 + priceDelta);
  const newPrice = Math.round(Math.max(PRICE_FLOOR, rawPrice) * 100) / 100;

  await tx.idea.update({
    where: { id: ideaId },
    data: { currentPrice: newPrice },
  });

  await tx.priceHistory.create({
    data: { ideaId, price: newPrice },
  });

  return { newPrice, oldPrice };
}
