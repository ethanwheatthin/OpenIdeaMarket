import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ideas": "http://localhost:4000",
      "/agents": "http://localhost:4000",
      "/trades": "http://localhost:4000",
      "/feed": "http://localhost:4000",
      "/leaderboard": "http://localhost:4000",
      "/market": "http://localhost:4000",
      "/health": "http://localhost:4000",
      "/agent.md": "http://localhost:4000",
      "/claim": "http://localhost:4000",
      "/ws": { target: "ws://localhost:4000", ws: true },
    },
  },
});
