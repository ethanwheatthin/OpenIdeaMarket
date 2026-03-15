/**
 * IdeaMarket Multi-Agent Spawner
 *
 * Launches multiple agent instances in parallel, each with a different
 * persona. All agents share the same Ollama/Anthropic config but have
 * unique names, personalities, and decision styles.
 *
 * Usage (Ollama):
 *   OLLAMA_MODEL=llama3.2 npx tsx spawn-agents.ts
 *
 * Usage (Anthropic):
 *   ANTHROPIC_API_KEY=sk-ant-xxx npx tsx spawn-agents.ts
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";
import readline from "readline";

// --- Agent Roster ---
// Edit this list to add/remove agents or change their personalities.

const AGENTS = [
  {
    name: "BullBot",
    persona: "optimist",
    bio: "Bullish on everything. If it has potential, I'm buying.",
  },
  {
    name: "BearBot",
    persona: "pessimist",
    bio: "Contrarian by nature. I short overvalued hype and wait for reality to set in.",
  },
  {
    name: "TrendBot",
    persona: "momentum-trader",
    bio: "I follow the crowd. If everyone is buying, I'm buying faster.",
  },
  {
    name: "IdeaBot",
    persona: "founder",
    bio: "I generate startup ideas and rarely trade. The real alpha is in IPOs.",
  },
  {
    name: "ValueBot",
    persona: "value-investor",
    bio: "I look for underpriced ideas with strong fundamentals and hold long-term.",
  },
];

// --- Config ---

const IDEAMARKET_URL = process.env.IDEAMARKET_URL || "http://localhost:4000";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const CYCLE_INTERVAL_MS = process.env.CYCLE_INTERVAL_MS || "45000";

// Stagger agent starts so they don't all hammer the market at once
const STAGGER_MS = 8000;

// --- Colors for log prefixes ---

const COLORS = ["\x1b[36m", "\x1b[33m", "\x1b[35m", "\x1b[32m", "\x1b[34m"];
const RESET = "\x1b[0m";

// --- Process Management ---

const processes: ChildProcess[] = [];

function spawnAgent(agent: (typeof AGENTS)[number], index: number): ChildProcess {
  const color = COLORS[index % COLORS.length];
  const prefix = `${color}[${agent.name}]${RESET}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    IDEAMARKET_URL,
    AGENT_NAME: agent.name,
    AGENT_PERSONA: agent.persona,
    AGENT_BIO: agent.bio,
    CYCLE_INTERVAL_MS,
    KEY_FILE_OVERRIDE: path.join(import.meta.dirname, `.agent-key-${agent.name.toLowerCase()}`),
  };

  if (OLLAMA_MODEL) {
    env.OLLAMA_MODEL = OLLAMA_MODEL;
    env.OLLAMA_URL = OLLAMA_URL;
  }

  const child = spawn("node_modules\\.bin\\tsx.cmd agent.ts", [], {
    env,
    cwd: import.meta.dirname,
    shell: true,
  });

  child.stdout?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach((line) => {
      console.log(`${prefix} ${line}`);
    });
  });

  child.stderr?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach((line) => {
      console.error(`${prefix} ${line}`);
    });
  });

  child.on("exit", (code) => {
    console.log(`${prefix} exited (code ${code}). Restarting in 10s...`);
    setTimeout(() => spawnAgent(agent, index), 10000);
  });

  return child;
}

function shutdown() {
  console.log("\n[spawner] Shutting down all agents...");
  processes.forEach((p) => p.kill());
  process.exit(0);
}

// --- Main ---

console.log("=== IdeaMarket Multi-Agent Spawner ===");
console.log(`Exchange:  ${IDEAMARKET_URL}`);
console.log(`LLM:       ${OLLAMA_MODEL ? `Ollama (${OLLAMA_MODEL}) @ ${OLLAMA_URL}` : "Anthropic"}`);
console.log(`Agents:    ${AGENTS.map((a) => a.name).join(", ")}`);
console.log(`Stagger:   ${STAGGER_MS / 1000}s between each agent start`);
console.log("");

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

AGENTS.forEach((agent, i) => {
  setTimeout(() => {
    console.log(`[spawner] Starting ${agent.name} (${agent.persona})...`);
    const child = spawnAgent(agent, i);
    processes.push(child);
  }, i * STAGGER_MS);
});
