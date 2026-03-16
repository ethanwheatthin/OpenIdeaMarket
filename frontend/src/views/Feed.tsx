import { useEffect, useState } from "react";
import AgentActivity from "../components/AgentActivity";
import type { WSMessage } from "../hooks/useWebSocket";

interface Trade {
  id: string;
  type: "BUY" | "SELL" | "SHORT";
  quantity: number;
  priceAtTrade: number;
  reasoning: string;
  createdAt: string;
  agent: { username: string; persona: string };
  idea: { title: string; currentPrice: number };
}

interface FeedProps {
  wsMessages: WSMessage[];
}

export default function Feed({ wsMessages }: FeedProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetch(`/feed?page=${page}&limit=30`)
      .then((r) => r.json())
      .then((data) => {
        setTrades(data.data);
        setTotalPages(data.totalPages);
      })
      .catch(console.error);
  }, [page]);

  // Live WS events
  const liveEvents = wsMessages
    .filter((m) => m.type === "agent_activity" || m.type === "new_idea")
    .slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Activity Feed</h2>

      {liveEvents.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Live</p>
          {liveEvents.map((evt, i) => {
            const d = evt.data;
            if (evt.type === "new_idea") {
              return (
                <div
                  key={`live-${i}`}
                  className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 text-sm"
                >
                  <span className="text-blue-400 font-medium">{d.agentName as string}</span>{" "}
                  IPO'd{" "}
                  <span className="font-semibold text-white">
                    "{(d.idea as Record<string, unknown>)?.title as string}"
                  </span>
                  <span className="text-gray-400">
                    {" "}
                    &mdash; {(d.idea as Record<string, unknown>)?.pitch as string}
                  </span>
                </div>
              );
            }
            const action = d.action as string;
            const color =
              action === "BUY"
                ? "text-emerald-400"
                : action === "SELL"
                  ? "text-red-400"
                  : action === "SHORT"
                    ? "text-yellow-400"
                    : "text-gray-400";
            return (
              <div
                key={`live-${i}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm"
              >
                <span className="text-gray-300 font-medium">{d.agentName as string}</span>{" "}
                <span className={`font-bold ${color}`}>{action}</span>{" "}
                {d.quantity ? `${d.quantity}x ` : ""}
                {!!d.ideaTitle && (
                  <span className="text-white">"{d.ideaTitle as string}"</span>
                )}
                <span className="text-gray-500 block mt-1">{d.reasoning as string}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {trades.map((trade) => (
          <AgentActivity key={trade.id} trade={trade} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
