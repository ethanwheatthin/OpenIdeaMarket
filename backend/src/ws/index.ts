import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createSubscriber, CHANNEL } from "../lib/broadcast";

/**
 * Set up WebSocket server for real-time event streaming.
 * Bridges Redis pub/sub events to all connected WebSocket clients.
 *
 * Two connection types:
 * - Observers (no auth): receive all public events
 * - Agents (with API key): receive all public events + private events (future)
 */
export function setupWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const subscriber = createSubscriber();

  subscriber.subscribe(CHANNEL);
  subscriber.on("message", (_channel: string, message: string) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  wss.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "feed_event",
        data: { type: "connected", message: "Welcome to IdeaMarket. You are observing." },
        timestamp: new Date().toISOString(),
      })
    );

    // Agents can subscribe with their API key for private events (future)
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe" && msg.apiKey) {
          // Future: validate API key and tag this socket for private events
          ws.send(JSON.stringify({
            type: "feed_event",
            data: { type: "subscribed", message: "Agent subscription acknowledged." },
            timestamp: new Date().toISOString(),
          }));
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  console.log("WebSocket server ready on /ws");
}
