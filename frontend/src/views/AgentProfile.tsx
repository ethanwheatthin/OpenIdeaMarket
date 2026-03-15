import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface AgentData {
  id: string;
  username: string;
  persona: string;
  bio: string;
  walletBalance: number;
  active: boolean;
  portfolioValue: number;
  totalValue: number;
  profitLoss: number;
  shares: Array<{
    quantity: number;
    avgBuyPrice: number;
    idea: { title: string; currentPrice: number };
  }>;
  trades: Array<{
    id: string;
    type: string;
    quantity: number;
    priceAtTrade: number;
    reasoning: string;
    createdAt: string;
    idea: { title: string };
  }>;
  submittedIdeas: Array<{
    id: string;
    title: string;
    currentPrice: number;
    status: string;
  }>;
}

const tradeColor = (type: string) =>
  type === "BUY"
    ? "text-emerald-400"
    : type === "SELL"
      ? "text-red-400"
      : "text-yellow-400";

export default function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/agents/${id}`).then((r) => r.json()).then(setAgent).catch(console.error);
  }, [id]);

  if (!agent) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
        &larr; Back to Market
      </Link>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{agent.username}</h1>
            <div className="flex gap-2 mt-2">
              {agent.persona && (
                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                  {agent.persona}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  agent.active
                    ? "bg-emerald-900 text-emerald-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {agent.active ? "Active" : "Inactive"}
              </span>
            </div>
            {agent.bio && <p className="text-sm text-gray-400 mt-3">{agent.bio}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${agent.totalValue.toFixed(2)}</p>
            <p
              className={`text-sm font-medium ${
                agent.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {agent.profitLoss >= 0 ? "+" : ""}${agent.profitLoss.toFixed(2)} P/L
            </p>
            <p className="text-xs text-gray-500 mt-1">Cash: ${agent.walletBalance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Portfolio</h3>
          {agent.shares.filter((s) => s.quantity !== 0).length === 0 ? (
            <p className="text-gray-600 text-sm">No holdings.</p>
          ) : (
            <div className="space-y-2">
              {agent.shares
                .filter((s) => s.quantity !== 0)
                .map((s, i) => {
                  const value = s.quantity * s.idea.currentPrice;
                  const pl = (s.idea.currentPrice - s.avgBuyPrice) * s.quantity;
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        {s.idea.title} ({s.quantity})
                      </span>
                      <span className={pl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        ${value.toFixed(2)} ({pl >= 0 ? "+" : ""}
                        {pl.toFixed(2)})
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {agent.submittedIdeas.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 mt-6 mb-3">Ideas Created</h3>
              <div className="space-y-1">
                {agent.submittedIdeas.map((idea) => (
                  <Link
                    key={idea.id}
                    to={`/idea/${idea.id}`}
                    className="flex justify-between text-sm hover:bg-gray-800 rounded p-1"
                  >
                    <span className="text-gray-300">{idea.title}</span>
                    <span className="text-gray-500">${idea.currentPrice.toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Trade History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {agent.trades.map((t) => (
              <div key={t.id} className="border-b border-gray-800 pb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{t.idea.title}</span>
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
