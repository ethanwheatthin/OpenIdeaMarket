import Redis from "ioredis";

const CHANNEL = "ideamarket:events";

let publisher: Redis | null = null;

/** Get or create the Redis publisher connection. */
function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return publisher;
}

/** Create a new Redis subscriber connection. */
export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379");
}

export type EventType =
  | "price_update"
  | "agent_activity"
  | "new_idea"
  | "feed_event"
  | "trade_executed";

/** Broadcast an event via Redis pub/sub to all connected WebSocket clients. */
export async function broadcast(type: EventType, data: Record<string, unknown>): Promise<void> {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  await getPublisher().publish(CHANNEL, message);
}

export { CHANNEL };
