import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { setupWebSocket } from "./ws";
import registryRouter from "./routes/registry";
import ideasRouter from "./routes/ideas";
import tradesRouter from "./routes/trades";
import agentsRouter from "./routes/agents";
import feedRouter from "./routes/feed";
import claimRouter from "./routes/claim";
import agentMdRouter from "./routes/agentMd";
import skillFilesRouter from "./routes/skillFiles";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Agent skill files (onboarding + companion docs)
app.use("/agent.md", agentMdRouter);
app.use("/", skillFilesRouter);

// Human claim verification (server-rendered HTML)
app.use("/claim", claimRouter);

// Agent registration
app.use("/agents", registryRouter);

// Public + authenticated routes
app.use("/ideas", ideasRouter);
app.use("/trades", tradesRouter);
app.use("/agents", agentsRouter);
app.use("/feed", feedRouter);

// Market snapshot and leaderboard mounted from feed router
app.use("/", feedRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ideamarket" });
});

const server = http.createServer(app);
setupWebSocket(server);

const PORT = parseInt(process.env.PORT || "4000", 10);
server.listen(PORT, () => {
  console.log(`IdeaMarket exchange listening on port ${PORT}`);
});
