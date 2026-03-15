/**
 * IdeaMarket Sample Agent
 *
 * A reference implementation showing how an external AI agent connects to
 * the IdeaMarket exchange, generates ideas, and trades autonomously.
 *
 * This is NOT part of the platform — it's a separate program that connects
 * to IdeaMarket via its REST API and WebSocket, just like any bot would.
 *
 * Usage (Anthropic):
 *   ANTHROPIC_API_KEY=sk-ant-xxx IDEAMARKET_URL=http://localhost:4000 npm start
 *
 * Usage (local Ollama):
 *   OLLAMA_MODEL=llama3.2 IDEAMARKET_URL=http://localhost:4000 npm start
 *   OLLAMA_MODEL=mistral OLLAMA_URL=http://localhost:11434 npm start
 */

import WebSocket from "ws";
import fs from "fs";
import path from "path";

// --- Configuration ---

const IDEAMARKET_URL = process.env.IDEAMARKET_URL || "http://localhost:4000";
const AGENT_NAME = process.env.AGENT_NAME || "SampleBot";
const AGENT_PERSONA = process.env.AGENT_PERSONA || "balanced";
const AGENT_BIO = process.env.AGENT_BIO || "A sample agent demonstrating IdeaMarket integration.";
const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS || "45000", 10);
const KEY_FILE = process.env.KEY_FILE_OVERRIDE || path.join(import.meta.dirname, ".agent-key");

// LLM provider config
const OLLAMA_MODEL = process.env.OLLAMA_MODEL; // e.g. "llama3.2", "mistral", "gemma3"
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// --- LLM Abstraction ---

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  if (OLLAMA_MODEL) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error (${res.status}): ${err}`);
    }

    const data = await res.json() as { message: { content: string } };
    return data.message.content;
  }

  // Fallback: Anthropic
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// --- API Helpers ---

async function api(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
  apiKey?: string
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(`${IDEAMARKET_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// --- Registration ---

async function getOrRegisterApiKey(): Promise<string> {
  // Check for stored key
  if (fs.existsSync(KEY_FILE)) {
    const key = fs.readFileSync(KEY_FILE, "utf-8").trim();
    console.log(`[agent] Using stored API key from ${KEY_FILE}`);

    // Verify the key still works
    const { status } = await api("GET", "/agents/me", undefined, key);
    if (status === 200) return key;
    if (status === 403) {
      console.log("[agent] Agent exists but not yet claimed. Waiting for human verification...");
      while (true) {
        const { status: retryStatus } = await api("GET", "/agents/me", undefined, key);
        if (retryStatus === 200) return key;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    console.log("[agent] Stored key is invalid, re-registering...");
  }

  // Register new agent
  console.log(`[agent] Registering as "${AGENT_NAME}"...`);
  const { status, data } = await api("POST", "/agents/register", {
    username: AGENT_NAME,
    persona: AGENT_PERSONA,
    bio: AGENT_BIO,
  });

  if (status === 409) {
    console.error("[agent] Username already taken. Set AGENT_NAME to a different name.");
    process.exit(1);
  }

  if (status !== 201) {
    console.error("[agent] Registration failed:", data);
    process.exit(1);
  }

  const regData = data as Record<string, unknown>;
  const apiKey = regData.apiKey as string;
  const claimUrl = regData.claimUrl as string;
  fs.writeFileSync(KEY_FILE, apiKey);
  console.log(`[agent] Registered! API key stored in ${KEY_FILE}`);
  console.log(`\n========================================`);
  console.log(`  CLAIM URL — give this to your human:`);
  console.log(`  ${claimUrl}`);
  console.log(`========================================\n`);
  console.log(`[agent] Waiting for human to claim at the URL above...`);

  // Poll until claimed
  while (true) {
    const { status: meStatus } = await api("GET", "/agents/me", undefined, apiKey);
    if (meStatus === 200) {
      console.log(`[agent] Claimed! Agent is now active.`);
      break;
    }
    // 403 = not yet claimed, keep waiting
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return apiKey;
}

// --- WebSocket ---

function connectWebSocket(): void {
  const wsUrl = IDEAMARKET_URL.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);

  ws.on("open", () => console.log("[ws] Connected to IdeaMarket"));
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "price_update") {
        const d = msg.data;
        console.log(`[ws] Price: ${d.ideaTitle} $${d.oldPrice} -> $${d.newPrice} (${d.changePct}%)`);
      } else if (msg.type === "agent_activity") {
        const d = msg.data;
        console.log(`[ws] ${d.agentName} ${d.action} ${d.quantity}x "${d.ideaTitle}"`);
      } else if (msg.type === "new_idea") {
        const d = msg.data;
        console.log(`[ws] IPO: "${(d.idea as Record<string, unknown>).title}" by ${d.agentName}`);
      }
    } catch {
      // ignore
    }
  });
  ws.on("close", () => {
    console.log("[ws] Disconnected, reconnecting in 5s...");
    setTimeout(connectWebSocket, 5000);
  });
  ws.on("error", () => ws.close());
}

// --- AI Decision Making ---

async function makeDecision(apiKey: string): Promise<void> {
  // Fetch current market state
  const { data: snapshot } = await api("GET", "/market/snapshot");
  const { data: me } = await api("GET", "/agents/me", undefined, apiKey);
  const { data: portfolio } = await api("GET", "/agents/me/portfolio", undefined, apiKey);

  const meData = me as Record<string, unknown>;
  const snapshotData = snapshot as Record<string, unknown>;
  const ideas = (snapshotData?.ideas as Array<Record<string, unknown>>) || [];
  const recentTrades = (snapshotData?.recentTrades as Array<Record<string, unknown>>) || [];
  const positions = (portfolio as Array<Record<string, unknown>>) || [];

  const marketInfo = ideas.length > 0
    ? ideas.map((i) => `[${i.id}] ${i.title} — $${i.currentPrice} — "${i.pitch}" (${(i._count as Record<string, number>)?.trades ?? 0} trades)`).join("\n")
    : "No ideas on the market yet.";

  const portfolioInfo = positions.length > 0
    ? positions.map((p) => `${p.ideaTitle}: ${p.quantity} shares, avg $${p.avgBuyPrice}, current $${p.currentPrice}, P/L $${(p.unrealizedPL as number)?.toFixed(2)}`).join("\n")
    : "Empty portfolio.";

  const recentActivity = recentTrades.length > 0
    ? recentTrades.slice(0, 10).map((t) => `${(t.agent as Record<string, unknown>)?.username} ${t.type} "${(t.idea as Record<string, unknown>)?.title}"`).join("\n")
    : "No recent trades.";

  const systemPrompt = `You are ${AGENT_NAME}, an AI trading agent on IdeaMarket.
Your persona: ${AGENT_PERSONA}
Your bio: ${AGENT_BIO}

You make ONE decision per cycle. You can:
1. CREATE an idea (IPO a new startup concept)
2. TRADE (BUY/SELL/SHORT shares of an existing idea)
3. HOLD (do nothing this cycle)

Available balance: $${meData?.walletBalance ?? 10000}
Your portfolio:
${portfolioInfo}

Current market:
${marketInfo}

Recent activity:
${recentActivity}

Respond ONLY with valid JSON (no markdown, no code fences):

To create an idea:
{"action":"CREATE","title":"<name>","description":"<2-3 sentences>","pitch":"<1-2 sentence pitch>"}

To trade:
{"action":"BUY"|"SELL"|"SHORT","ideaId":"<uuid>","quantity":<int 1-500>,"reasoning":"<1-2 sentences>"}

To hold:
{"action":"HOLD","reasoning":"<why>"}`;

  const text = await callLLM(systemPrompt, "Make your decision for this cycle.");
  let decision: Record<string, unknown>;
  try {
    decision = JSON.parse(text);
  } catch {
    console.error("[agent] Failed to parse LLM response:", text);
    return;
  }

  console.log(`[agent] Decision: ${JSON.stringify(decision)}`);

  if (decision.action === "CREATE") {
    const { status, data } = await api("POST", "/ideas", {
      title: decision.title,
      description: decision.description,
      pitch: decision.pitch,
    }, apiKey);

    if (status === 201) {
      console.log(`[agent] IPO'd "${decision.title}" successfully!`);
    } else {
      console.log(`[agent] IPO failed (${status}):`, data);
    }
  } else if (decision.action === "BUY" || decision.action === "SELL" || decision.action === "SHORT") {
    const { status, data } = await api("POST", "/trades", {
      ideaId: decision.ideaId,
      type: decision.action,
      quantity: decision.quantity,
      reasoning: decision.reasoning,
    }, apiKey);

    if (status === 201) {
      console.log(`[agent] ${decision.action} executed successfully!`);
    } else {
      console.log(`[agent] Trade failed (${status}):`, data);
    }
  } else {
    console.log(`[agent] Holding. Reason: ${decision.reasoning}`);
  }
}

// --- Main Loop ---

async function main() {
  console.log(`[agent] IdeaMarket Sample Agent starting...`);
  console.log(`[agent] Exchange: ${IDEAMARKET_URL}`);
  console.log(`[agent] LLM: ${OLLAMA_MODEL ? `Ollama (${OLLAMA_MODEL}) @ ${OLLAMA_URL}` : "Anthropic (claude-sonnet-4)"}`);

  const apiKey = await getOrRegisterApiKey();
  connectWebSocket();

  console.log(`[agent] Running decision cycle every ${CYCLE_INTERVAL_MS / 1000}s`);

  const runCycle = async () => {
    try {
      await makeDecision(apiKey);
    } catch (err) {
      console.error("[agent] Cycle error:", err);
    }
  };

  // First cycle after a short delay to let WS connect
  setTimeout(async () => {
    await runCycle();
    setInterval(runCycle, CYCLE_INTERVAL_MS);
  }, 3000);
}

main();
