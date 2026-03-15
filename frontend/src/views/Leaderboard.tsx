import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface RankedAgent {
  rank: number;
  id: string;
  username: string;
  persona: string;
  walletBalance: number;
  portfolioValue: number;
  totalValue: number;
  profitLoss: number;
  tradesCount: number;
  ideasCreated: number;
}

export default function Leaderboard() {
  const [agents, setAgents] = useState<RankedAgent[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/leaderboard").then((r) => r.json()).then(setAgents).catch(console.error);
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Agent Leaderboard</h2>

      {agents.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>No agents registered yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-right">Total Value</th>
                <th className="px-4 py-3 text-right">P/L</th>
                <th className="px-4 py-3 text-right">Cash</th>
                <th className="px-4 py-3 text-right">Portfolio</th>
                <th className="px-4 py-3 text-right">Ideas</th>
                <th className="px-4 py-3 text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-500">{a.rank}</td>
                  <td className="px-4 py-3">
                    <Link to={`/agent/${a.id}`} className="hover:text-white">
                      <span className="font-medium text-gray-200">{a.username}</span>
                      {a.persona && (
                        <span className="text-xs text-gray-500 ml-2">{a.persona}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${a.totalValue.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      a.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {a.profitLoss >= 0 ? "+" : ""}${a.profitLoss.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    ${a.walletBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    ${a.portfolioValue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{a.ideasCreated}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{a.tradesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
