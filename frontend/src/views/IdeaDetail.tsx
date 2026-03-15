import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PriceChart from "../components/PriceChart";

interface IdeaData {
  id: string;
  title: string;
  description: string;
  pitch: string;
  currentPrice: number;
  totalShares: number;
  status: string;
  createdAt: string;
  submitter: { username: string; persona: string };
  priceHistory: Array<{ price: number; recordedAt: string }>;
  trades: Array<{
    id: string;
    type: string;
    quantity: number;
    priceAtTrade: number;
    reasoning: string;
    createdAt: string;
    agent: { username: string; persona: string };
  }>;
  shares: Array<{
    quantity: number;
    owner: { username: string; persona: string };
  }>;
}

const tradeColor = (type: string) =>
  type === "BUY"
    ? "text-emerald-400"
    : type === "SELL"
      ? "text-red-400"
      : type === "SHORT"
        ? "text-yellow-400"
        : "text-gray-400";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [idea, setIdea] = useState<IdeaData | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/ideas/${id}`).then((r) => r.json()).then(setIdea).catch(console.error);
  }, [id]);

  if (!idea) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
        &larr; Back to Market
      </Link>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{idea.title}</h1>
            <p className="text-gray-400 mt-1">{idea.description}</p>
            <p className="text-sm text-emerald-400 mt-2 italic">"{idea.pitch}"</p>
            <p className="text-xs text-gray-500 mt-2">
              IPO'd by{" "}
              <Link to={`/agent/${idea.submitter.username}`} className="text-gray-300 hover:text-white">
                {idea.submitter.username}
              </Link>
              {idea.submitter.persona && ` (${idea.submitter.persona})`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-400">${idea.currentPrice.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{idea.totalShares} total shares</p>
            <span
              className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                idea.status === "ACTIVE"
                  ? "bg-emerald-900 text-emerald-300"
                  : "bg-red-900 text-red-300"
              }`}
            >
              {idea.status}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Price History</h3>
        <PriceChart data={idea.priceHistory} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Holders</h3>
          {idea.shares.length === 0 ? (
            <p className="text-gray-600 text-sm">No holders yet.</p>
          ) : (
            <div className="space-y-2">
              {[...idea.shares]
                .sort((a, b) => b.quantity - a.quantity)
                .map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-300">{s.owner.username}</span>
                    <span className="text-gray-500">
                      {s.quantity} shares (
                      {((s.quantity / idea.totalShares) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Trades</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {idea.trades.map((t) => (
              <div key={t.id} className="border-b border-gray-800 pb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{t.agent.username}</span>
                  <span className={`font-medium ${tradeColor(t.type)}`}>
                    {t.type} {t.quantity}x @ ${t.priceAtTrade.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
