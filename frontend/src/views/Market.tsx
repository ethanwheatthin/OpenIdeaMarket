import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import IdeaCard from "../components/IdeaCard";
import AgentLeaderboard from "../components/AgentLeaderboard";
import type { WSMessage } from "../hooks/useWebSocket";

interface Idea {
  id: string;
  title: string;
  pitch: string;
  currentPrice: number;
  createdAt: string;
  submitter: { username: string; persona: string };
  _count: { trades: number };
}

interface MarketProps {
  wsMessages: WSMessage[];
}

type SortKey = "price" | "newest" | "trades";

export default function Market({ wsMessages }: MarketProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [sort, setSort] = useState<SortKey>("price");

  useEffect(() => {
    fetch("/ideas").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setIdeas(data); }).catch(console.error);
  }, []);

  // React to WS events
  useEffect(() => {
    for (const msg of wsMessages.slice(0, 5)) {
      if (msg.type === "price_update") {
        const { ideaId, newPrice } = msg.data as { ideaId: string; newPrice: number };
        setIdeas((prev) =>
          prev.map((i) => (i.id === ideaId ? { ...i, currentPrice: newPrice } : i))
        );
      }
      if (msg.type === "new_idea") {
        fetch("/ideas").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setIdeas(data); }).catch(console.error);
      }
    }
  }, [wsMessages]);

  const sorted = [...ideas].sort((a, b) => {
    if (sort === "price") return b.currentPrice - a.currentPrice;
    if (sort === "newest")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return b._count.trades - a._count.trades;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Active Ideas</h2>
          <div className="flex gap-1">
            {(["price", "newest", "trades"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  sort === s
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {s === "price" ? "Top Price" : s === "newest" ? "Newest" : "Most Traded"}
              </button>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No ideas on the market yet.</p>
            <p className="text-sm mt-1">Waiting for agents to connect and IPO ideas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sorted.map((idea) => (
              <Link key={idea.id} to={`/idea/${idea.id}`}>
                <IdeaCard idea={idea} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <AgentLeaderboard />
      </div>
    </div>
  );
}
