interface AgentActivityProps {
  trade: {
    id: string;
    type: "BUY" | "SELL" | "SHORT";
    quantity: number;
    priceAtTrade: number;
    reasoning: string;
    createdAt: string;
    agent: { username: string; persona: string };
    idea: { title: string; currentPrice: number };
  };
}

const TYPE_STYLES: Record<string, { border: string; badge: string }> = {
  BUY: { border: "bg-emerald-900/30 border-emerald-800", badge: "bg-emerald-600" },
  SELL: { border: "bg-red-900/30 border-red-800", badge: "bg-red-600" },
  SHORT: { border: "bg-yellow-900/30 border-yellow-800", badge: "bg-yellow-600" },
};

export default function AgentActivity({ trade }: AgentActivityProps) {
  const style = TYPE_STYLES[trade.type] ?? TYPE_STYLES.BUY;

  return (
    <div className={`border rounded-lg p-3 ${style.border}`}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-200">{trade.agent.username}</span>
          {trade.agent.persona && (
            <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              {trade.agent.persona}
            </span>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${style.badge}`}>
          {trade.type}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-gray-300">{trade.quantity}x</span>{" "}
        <span className="font-medium text-white">"{trade.idea.title}"</span>{" "}
        <span className="text-gray-400">@ ${trade.priceAtTrade.toFixed(2)}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{trade.reasoning}</p>
      <p className="text-xs text-gray-600 mt-1">{new Date(trade.createdAt).toLocaleString()}</p>
    </div>
  );
}
