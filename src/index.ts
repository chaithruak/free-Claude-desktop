import express, { Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../public")));

const PORT = parseInt(process.env.PORT || "8082");
const CONFIG_PATH = path.join(__dirname, "../config.json");

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderType = "openai-compat" | "ollama" | "anthropic";

interface Provider {
  type: ProviderType;
  baseUrl: string;
  apiKeyEnv: string;   // env var name fallback, e.g. "NVIDIA_API_KEY"
  apiKey?: string;     // actual key stored in config.json (takes priority over env var)
  model: string;
  label: string;       // display name in UI
  enabled: boolean;
}

interface Config {
  active: string;
  port: number;
  authToken: string;   // optional — empty = no auth
  providers: Record<string, Provider>;
  log: LogEntry[];
}

interface LogEntry {
  ts: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  error?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    const def = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function saveConfig(cfg: Config) {
  // Never persist log to disk beyond last 200 entries
  const toSave = { ...cfg, log: cfg.log.slice(-200) };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2));
}

function defaultConfig(): Config {
  return {
    active: "nvidia",
    port: 8082,
    authToken: "",
    providers: {
      nvidia: {
        type: "openai-compat",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        apiKeyEnv: "NVIDIA_API_KEY",
        model: "stepfun-ai/step-3.7-flash",
        label: "NVIDIA NIM",
        enabled: true,
      },
      ollama: {
        type: "ollama",
        baseUrl: "http://localhost:11434",
        apiKeyEnv: "",
        model: "llama3.2",
        label: "Ollama (Local)",
        enabled: true,
      },
      openai: {
        type: "openai-compat",
        baseUrl: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
        model: "gpt-4o",
        label: "OpenAI",
        enabled: false,
      },
      groq: {
        type: "openai-compat",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKeyEnv: "GROQ_API_KEY",
        model: "llama-3.3-70b-versatile",
        label: "Groq",
        enabled: false,
      },
      mistral: {
        type: "openai-compat",
        baseUrl: "https://api.mistral.ai/v1",
        apiKeyEnv: "MISTRAL_API_KEY",
        model: "mistral-large-latest",
        label: "Mistral",
        enabled: false,
      },
      together: {
        type: "openai-compat",
        baseUrl: "https://api.together.xyz/v1",
        apiKeyEnv: "TOGETHER_API_KEY",
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        label: "Together AI",
        enabled: false,
      },
      openrouter: {
        type: "openai-compat",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
        model: "deepseek/deepseek-r1-0528:free",
        label: "OpenRouter",
        enabled: false,
      },
      anthropic: {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        apiKeyEnv: "ANTHROPIC_API_KEY",
        model: "claude-sonnet-4-20250514",
        label: "Real Claude (Anthropic)",
        enabled: true,
      },
    },
    log: [],
  };
}

function resolveApiKey(provider: Provider): string {
  // Config key takes priority — set via Admin UI, no restart needed
  if (provider.apiKey && provider.apiKey.trim()) return provider.apiKey.trim();
  // Fall back to env var (set in .env file)
  if (!provider.apiKeyEnv) return "";
  return process.env[provider.apiKeyEnv] || "";
}

// ─── Message format converters ────────────────────────────────────────────────

function toOpenAIMessages(body: any): { role: string; content: string }[] {
  const msgs: { role: string; content: string }[] = [];
  if (body.system) msgs.push({ role: "system", content: body.system });
  for (const msg of body.messages || []) {
    if (typeof msg.content === "string") {
      msgs.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const text = msg.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
      msgs.push({ role: msg.role, content: text });
    }
  }
  return msgs;
}

function toAnthropicResponse(content: string, model: string, usage: any) {
  return {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: content }],
    model,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
    },
  };
}

// ─── Provider calls ───────────────────────────────────────────────────────────

async function callOpenAICompat(provider: Provider, body: any) {
  const apiKey = resolveApiKey(provider);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // OpenRouter requires these headers or some models return "No endpoints found"
  if (provider.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://127.0.0.1:8082";
    headers["X-Title"] = "Free Claude Desktop";
  }

  const r = await axios.post(
    `${provider.baseUrl}/chat/completions`,
    {
      model: provider.model,
      messages: toOpenAIMessages(body),
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    },
    { headers, timeout: 120000 }
  );

  const choice = r.data.choices?.[0];
  return toAnthropicResponse(choice?.message?.content ?? "", provider.model, r.data.usage);
}

async function callOllama(provider: Provider, body: any) {
  const r = await axios.post(
    `${provider.baseUrl}/api/chat`,
    {
      model: provider.model,
      messages: toOpenAIMessages(body),
      stream: false,
      options: {
        temperature: body.temperature ?? 0.7,
        num_predict: body.max_tokens ?? 1024,
      },
    },
    { timeout: 120000 }
  );

  return toAnthropicResponse(r.data.message?.content ?? "", provider.model, {
    prompt_tokens: r.data.prompt_eval_count ?? 0,
    completion_tokens: r.data.eval_count ?? 0,
  });
}

async function callAnthropic(provider: Provider, body: any) {
  const apiKey = resolveApiKey(provider);
  const r = await axios.post(
    `${provider.baseUrl}/v1/messages`,
    {
      model: provider.model,
      messages: body.messages,
      max_tokens: body.max_tokens ?? 1024,
      temperature: body.temperature ?? 0.7,
      ...(body.system && { system: body.system }),
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: 120000,
    }
  );
  return r.data;
}

// ─── SSE streaming ────────────────────────────────────────────────────────────

// Helper: write one Anthropic SSE event to the response
function sseEvent(res: Response, eventName: string, data: any) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Send the standard Anthropic SSE opening events
function sseStart(res: Response, model: string) {
  const msgId = `msg_${Date.now()}`;
  sseEvent(res, "message_start", {
    type: "message_start",
    message: {
      id: msgId,
      type: "message",
      role: "assistant",
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  sseEvent(res, "content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });
  // ping keeps some clients from idling out
  sseEvent(res, "ping", { type: "ping" });
}

// Send a text delta
function sseDelta(res: Response, text: string) {
  sseEvent(res, "content_block_delta", {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  });
}

// Send the closing events
function sseStop(res: Response, tokensOut: number, tokensIn: number) {
  sseEvent(res, "content_block_stop", { type: "content_block_stop", index: 0 });
  sseEvent(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: tokensOut },
  });
  sseEvent(res, "message_stop", { type: "message_stop" });
}

// Parse an OpenAI-style SSE chunk buffer; returns { deltas[], done }
function parseOpenAIChunks(buffer: string): { deltas: string[]; leftover: string; done: boolean } {
  const deltas: string[] = [];
  let done = false;
  const lines = buffer.split("\n");
  // Keep the last (possibly partial) line as leftover
  const leftover = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") { done = true; continue; }
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) deltas.push(delta);
    } catch {
      // partial JSON — ignore, will arrive complete next chunk
    }
  }
  return { deltas, leftover, done };
}

// Stream from an OpenAI-compatible provider (NVIDIA, Groq, OpenAI, etc.)
async function streamOpenAICompat(provider: Provider, body: any, res: Response): Promise<number> {
  const apiKey = resolveApiKey(provider);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // OpenRouter requires these headers
  if (provider.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://127.0.0.1:8082";
    headers["X-Title"] = "Free Claude Desktop";
  }

  const upstream = await axios.post(
    `${provider.baseUrl}/chat/completions`,
    {
      model: provider.model,
      messages: toOpenAIMessages(body),
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
      stream: true,
    },
    { headers, timeout: 300000, responseType: "stream" }
  );

  let charCount = 0;
  let buffer = "";

  return new Promise<number>((resolve, reject) => {
    upstream.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const { deltas, leftover } = parseOpenAIChunks(buffer);
      buffer = leftover;
      for (const d of deltas) {
        sseDelta(res, d);
        charCount += d.length;
      }
    });
    upstream.data.on("end", () => {
      // flush any complete event left in buffer
      const { deltas } = parseOpenAIChunks(buffer + "\n");
      for (const d of deltas) { sseDelta(res, d); charCount += d.length; }
      resolve(Math.ceil(charCount / 4)); // rough token estimate
    });
    upstream.data.on("error", (e: any) => reject(e));
  });
}

// Stream from Ollama (newline-delimited JSON, not SSE)
async function streamOllama(provider: Provider, body: any, res: Response): Promise<number> {
  const upstream = await axios.post(
    `${provider.baseUrl}/api/chat`,
    {
      model: provider.model,
      messages: toOpenAIMessages(body),
      stream: true,
      options: {
        temperature: body.temperature ?? 0.7,
        num_predict: body.max_tokens ?? 1024,
      },
    },
    { timeout: 300000, responseType: "stream" }
  );

  let charCount = 0;
  let buffer = "";

  return new Promise<number>((resolve, reject) => {
    upstream.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const text = json.message?.content;
          if (text) { sseDelta(res, text); charCount += text.length; }
        } catch { /* partial line */ }
      }
    });
    upstream.data.on("end", () => resolve(Math.ceil(charCount / 4)));
    upstream.data.on("error", (e: any) => reject(e));
  });
}

// Stream from Anthropic — already SSE in the right format, pass through deltas
async function streamAnthropic(provider: Provider, body: any, res: Response): Promise<number> {
  const apiKey = resolveApiKey(provider);
  const upstream = await axios.post(
    `${provider.baseUrl}/v1/messages`,
    {
      model: provider.model,
      messages: body.messages,
      max_tokens: body.max_tokens ?? 1024,
      temperature: body.temperature ?? 0.7,
      stream: true,
      ...(body.system && { system: body.system }),
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: 300000,
      responseType: "stream",
    }
  );

  let charCount = 0;
  let buffer = "";

  return new Promise<number>((resolve, reject) => {
    upstream.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        try {
          const json = JSON.parse(payload);
          if (json.type === "content_block_delta" && json.delta?.text) {
            sseDelta(res, json.delta.text);
            charCount += json.delta.text.length;
          }
        } catch { /* partial */ }
      }
    });
    upstream.data.on("end", () => resolve(Math.ceil(charCount / 4)));
    upstream.data.on("error", (e: any) => reject(e));
  });
}

async function handleStreaming(provider: Provider, providerName: string, req: Request, res: Response, cfg: Config, start: number) {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseStart(res, provider.model);

  try {
    let tokensOut = 0;
    switch (provider.type) {
      case "openai-compat": tokensOut = await streamOpenAICompat(provider, req.body, res); break;
      case "ollama":        tokensOut = await streamOllama(provider, req.body, res); break;
      case "anthropic":     tokensOut = await streamAnthropic(provider, req.body, res); break;
    }

    sseStop(res, tokensOut, 0);
    res.end();

    const latencyMs = Date.now() - start;
    cfg.log.push({
      ts: new Date().toISOString(),
      provider: providerName,
      model: provider.model,
      tokensIn: 0,
      tokensOut,
      latencyMs,
    });
    saveConfig(cfg);
    console.log(`  ✓ (stream) ${latencyMs}ms | ~out:${tokensOut}`);
  } catch (err: any) {
    const message = err.response?.data?.error?.message || err.message;
    console.error(`  ✗ (stream) ${message}`);
    // If headers already sent, emit an SSE error then close
    sseEvent(res, "error", { type: "error", error: { type: "api_error", message } });
    res.end();
    cfg.log.push({
      ts: new Date().toISOString(),
      provider: providerName,
      model: provider.model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - start,
      error: message,
    });
    saveConfig(cfg);
  }
}

// ─── Main proxy endpoint ──────────────────────────────────────────────────────

app.post("/v1/messages", async (req: Request, res: Response) => {
  const cfg = loadConfig();

  // Optional auth check
  if (cfg.authToken) {
    const token = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
    if (token !== cfg.authToken) {
      return res.status(401).json({ type: "error", error: { message: "Unauthorized" } });
    }
  }

  const providerName = cfg.active;
  const provider = cfg.providers[providerName];
  if (!provider) {
    return res.status(400).json({ type: "error", error: { message: `Provider "${providerName}" not configured` } });
  }

  const start = Date.now();
  console.log(`[${new Date().toISOString()}] → ${providerName} | ${provider.model}${req.body.stream ? " (stream)" : ""}`);

  // Branch: streaming vs non-streaming
  if (req.body.stream) {
    return handleStreaming(provider, providerName, req, res, cfg, start);
  }

  try {
    let result: any;
    switch (provider.type) {
      case "openai-compat": result = await callOpenAICompat(provider, req.body); break;
      case "ollama":        result = await callOllama(provider, req.body); break;
      case "anthropic":     result = await callAnthropic(provider, req.body); break;
      default:
        return res.status(400).json({ type: "error", error: { message: `Unknown type: ${provider.type}` } });
    }

    const latencyMs = Date.now() - start;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      provider: providerName,
      model: provider.model,
      tokensIn: result.usage?.input_tokens ?? 0,
      tokensOut: result.usage?.output_tokens ?? 0,
      latencyMs,
    };
    cfg.log.push(entry);
    saveConfig(cfg);

    console.log(`  ✓ ${latencyMs}ms | in:${entry.tokensIn} out:${entry.tokensOut}`);
    res.json(result);
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      provider: providerName,
      model: provider.model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - start,
      error: message,
    };
    cfg.log.push(entry);
    saveConfig(cfg);
    console.error(`  ✗ ${message}`);
    res.status(status).json({ type: "error", error: { type: "api_error", message } });
  }
});

// ─── Admin API ────────────────────────────────────────────────────────────────

// Get full config (API keys never fully exposed — only last 4 chars shown)
app.get("/admin/api/config", (_req, res) => {
  const cfg = loadConfig();
  const safe = JSON.parse(JSON.stringify(cfg));
  for (const name of Object.keys(safe.providers)) {
    const p = safe.providers[name];
    const resolvedKey = resolveApiKey(p);
    const keySet = resolvedKey.length > 0;
    const keySource = p.apiKey?.trim() ? "config" : (process.env[p.apiKeyEnv] ? "env" : "none");
    const keyHint = keySet ? `...${resolvedKey.slice(-4)}` : "";
    // Never send actual key to browser
    delete p.apiKey;
    (p as any).apiKeySet = keySet;
    (p as any).apiKeySource = keySource;  // "config" | "env" | "none"
    (p as any).apiKeyHint = keyHint;      // last 4 chars e.g. "...oh5"
  }
  res.json(safe);
});

// Switch active provider
app.post("/admin/api/switch/:provider", (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.provider;
  if (!cfg.providers[name]) {
    return res.status(404).json({ error: `Provider "${name}" not found` });
  }
  cfg.active = name;
  saveConfig(cfg);
  console.log(`[ADMIN] Switched to: ${name}`);
  res.json({ active: name, model: cfg.providers[name].model });
});

// Verify provider works THEN switch — used by the Admin UI "Use This" button
app.post("/admin/api/switch-verified/:provider", async (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.provider;
  const provider = cfg.providers[name];
  if (!provider) {
    return res.status(404).json({ ok: false, error: `Provider "${name}" not found` });
  }

  // Run a quick test call first
  const testBody = {
    messages: [{ role: "user", content: "Reply with just the word: OK" }],
    max_tokens: 10,
    temperature: 0,
  };

  try {
    let result: any;
    switch (provider.type) {
      case "openai-compat": result = await callOpenAICompat(provider, testBody); break;
      case "ollama":        result = await callOllama(provider, testBody); break;
      case "anthropic":     result = await callAnthropic(provider, testBody); break;
    }
    const reply = result?.content?.[0]?.text ?? "";

    // Verification passed — now commit the switch
    cfg.active = name;
    saveConfig(cfg);
    console.log(`[ADMIN] Verified + switched to: ${name} (reply: "${reply}")`);
    res.json({ ok: true, active: name, model: provider.model, reply });
  } catch (err: any) {
    const message = err.response?.data?.error?.message || err.message;
    console.error(`[ADMIN] Verify failed for ${name}: ${message}`);
    // Do NOT switch — return error so UI can show it
    res.json({ ok: false, error: message, provider: name });
  }
});

// Save API key for a provider — stored in config.json, takes effect immediately
app.post("/admin/api/provider/:name/key", (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.name;
  const { apiKey } = req.body;

  if (!cfg.providers[name]) {
    return res.status(404).json({ error: `Provider "${name}" not found` });
  }

  if (apiKey === "" || apiKey === null) {
    // Clear the stored key — will fall back to env var
    delete cfg.providers[name].apiKey;
    saveConfig(cfg);
    console.log(`[ADMIN] Cleared stored key for: ${name}`);
    return res.json({ ok: true, cleared: true });
  }

  cfg.providers[name].apiKey = apiKey.trim();
  saveConfig(cfg);
  const hint = `...${apiKey.trim().slice(-4)}`;
  console.log(`[ADMIN] API key updated for: ${name} (${hint})`);
  res.json({ ok: true, hint });
});

// Update provider config
app.post("/admin/api/provider/:name", (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.name;
  const { model, baseUrl, type, label, enabled, apiKeyEnv, apiKey } = req.body;

  if (!cfg.providers[name]) {
    cfg.providers[name] = { type, baseUrl, apiKeyEnv, model, label, enabled };
  } else {
    const p = cfg.providers[name];
    if (model !== undefined)     p.model = model;
    if (baseUrl !== undefined)   p.baseUrl = baseUrl;
    if (type !== undefined)      p.type = type;
    if (label !== undefined)     p.label = label;
    if (enabled !== undefined)   p.enabled = enabled;
    if (apiKeyEnv !== undefined) p.apiKeyEnv = apiKeyEnv;
    // Only update stored key if explicitly provided and non-empty
    if (apiKey !== undefined && apiKey !== "" && apiKey !== null) {
      p.apiKey = apiKey.trim();
    }
  }

  saveConfig(cfg);
  // Return safe version — no key in response
  const safe = { ...cfg.providers[name] } as any;
  delete safe.apiKey;
  res.json({ ok: true, provider: safe });
});

// Delete provider
app.delete("/admin/api/provider/:name", (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.name;
  if (cfg.active === name) {
    return res.status(400).json({ error: "Cannot delete active provider. Switch first." });
  }
  delete cfg.providers[name];
  saveConfig(cfg);
  res.json({ ok: true });
});

// Validate provider (test connection)
app.post("/admin/api/validate/:name", async (req: Request, res: Response) => {
  const cfg = loadConfig();
  const name = req.params.name;
  const provider = cfg.providers[name];
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  const testBody = {
    messages: [{ role: "user", content: "Reply with just the word: OK" }],
    max_tokens: 10,
    temperature: 0,
  };

  try {
    let result: any;
    switch (provider.type) {
      case "openai-compat": result = await callOpenAICompat(provider, testBody); break;
      case "ollama":        result = await callOllama(provider, testBody); break;
      case "anthropic":     result = await callAnthropic(provider, testBody); break;
    }
    const reply = result?.content?.[0]?.text ?? "";
    res.json({ ok: true, reply, model: provider.model });
  } catch (err: any) {
    const message = err.response?.data?.error?.message || err.message;
    res.json({ ok: false, error: message });
  }
});

// Get request log
app.get("/admin/api/log", (_req, res) => {
  const cfg = loadConfig();
  res.json(cfg.log.slice().reverse().slice(0, 100));
});

// Clear log
app.delete("/admin/api/log", (_req, res) => {
  const cfg = loadConfig();
  cfg.log = [];
  saveConfig(cfg);
  res.json({ ok: true });
});

// Status
app.get("/health", (_req, res) => {
  const cfg = loadConfig();
  res.json({ status: "ok", active: cfg.active, port: PORT });
});

// Admin UI — serve index.html
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/admin/*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "127.0.0.1", () => {
  const cfg = loadConfig();
  const active = cfg.providers[cfg.active];
  console.log("══════════════════════════════════════════════");
  console.log(`  Free Claude Desktop`);
  console.log(`  Proxy  : http://127.0.0.1:${PORT}/v1/messages`);
  console.log(`  Admin  : http://127.0.0.1:${PORT}/admin`);
  console.log(`  Active : ${cfg.active} → ${active?.model}`);
  console.log(`  Tip    : Switch providers anytime at /admin`);
  console.log("══════════════════════════════════════════════");
});
