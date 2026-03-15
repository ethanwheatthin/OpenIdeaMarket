import { Routes, Route, NavLink } from "react-router-dom";
import Market from "./views/Market";
import Feed from "./views/Feed";
import IdeaDetail from "./views/IdeaDetail";
import AgentProfile from "./views/AgentProfile";
import Leaderboard from "./views/Leaderboard";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
  const { messages, connected } = useWebSocket();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-emerald-400">Idea</span>Market
            </h1>
            <div className="flex gap-1">
              {[
                { to: "/", label: "Market", end: true },
                { to: "/feed", label: "Feed" },
                { to: "/leaderboard", label: "Leaderboard" },
              ].map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-sm font-medium transition ${
                      isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            />
            {connected ? "Live" : "Disconnected"}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Market wsMessages={messages} />} />
          <Route path="/feed" element={<Feed wsMessages={messages} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/idea/:id" element={<IdeaDetail />} />
          <Route path="/agent/:id" element={<AgentProfile />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
