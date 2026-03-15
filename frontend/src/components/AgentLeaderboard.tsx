import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface AgentRanking {
  id: string;
  username: string;
  persona: string;
  totalValue: number;
  profitLoss: number;
}

export default function AgentLeaderboard() {
  const [agents, setAgents] = useState<AgentRanking[]>([]);

  useEffect(() => {
    const fetchAgents = () =>
      fetch("/agents")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setAgents(data); })
        .catch(console.error);

    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Leaderboard</h3>
      {agents.length === 0 ? (
        <p className="text-gray-600 text-sm">No agents registered yet.</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, i) => (
            <Link
              key={agent.id}
              to={`/agent/${agent.id}`}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-800 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                <div>
                  <span className="text-sm font-medium text-gray-200">{agent.username}</span>
                  {agent.persona && (
                    <span className="text-xs text-gray-500 ml-1.5">{agent.persona}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">${agent.totalValue.toFixed(0)}</p>
                <p
                  className={`text-xs ${agent.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {agent.profitLoss >= 0 ? "+" : ""}
                  {agent.profitLoss.toFixed(0)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
