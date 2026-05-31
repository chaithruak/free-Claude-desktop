# Free Claude Desktop

Routes Claude Desktop to any LLM provider instead of Anthropic, with a
browser-based Admin UI to switch between them instantly — no restarts,
no env var changes, ever.

```
Claude Desktop → http://127.0.0.1:8082 → Proxy → Your chosen LLM
```

---

## Features

- **Admin UI** at http://127.0.0.1:8082/admin — switch providers with one click
- **Verify-then-switch** — tests the provider before committing the switch
- **SSE streaming** — tokens appear progressively, no lag or timeouts
- **Auto-start service** — proxy runs in background on every Windows login
- **Request log** — every request logged with provider, model, tokens, latency
- **Add any provider** — anything with an OpenAI-compatible API works

---

## Supported Providers

| Provider | Type | Notes |
|----------|------|-------|
| NVIDIA NIM | openai-compat | 100+ models, free tier available |
| Real Claude (Anthropic) | anthropic | Switch back to real Claude via UI |
| Ollama | ollama | Local, free, no API key needed |
| OpenAI | openai-compat | GPT-4o etc |
| Groq | openai-compat | Very fast, free tier |
| Mistral | openai-compat | European alternative |
| Together AI | openai-compat | Many open models |
| OpenRouter | openai-compat | 100s of models, free tier |

Any OpenAI-compatible API also works — LM Studio, llama.cpp, LiteLLM, Jan, etc.

---

## Requirements

- Windows 10/11
- Node.js 18+ → https://nodejs.org
- Claude Desktop installed
- API key for whichever cloud providers you want to use

---

## Getting API Keys (First Time)

You need at least one API key to get started. NVIDIA and OpenRouter both
have generous free tiers — recommended for first-time users.

---

### NVIDIA NIM (Recommended — 40 requests/min free)

NVIDIA gives you access to 100+ models including the fast `stepfun-ai/step-3.7-flash`.

1. Go to https://build.nvidia.com
2. Click **Sign In** (top right) → create a free account
3. After login, click your profile icon (top right) → **API Keys**
4. Click **Generate API Key**
5. Copy the key — it starts with `nvapi-`

In the Admin UI:
- Click **✎ Edit** on the NVIDIA card
- Paste the key in the **API Key** field
- Click **Save Key**

**Popular NVIDIA models to try:**
```
stepfun-ai/step-3.7-flash       ← fast, good quality (default)
stepfun-ai/step-3.5-flash       ← faster, lighter
meta/llama-3.3-70b-instruct     ← Meta's best open model
nvidia/llama-3.1-nemotron-70b-instruct  ← NVIDIA optimized
deepseek-ai/deepseek-v4-flash   ← great for coding
```

To change model: click **✎ Edit** on NVIDIA card → update the Model field → Save.

---

### OpenRouter (100s of models, generous free tier)

OpenRouter gives access to models from many providers in one place, including
free models with no credit card required.

1. Go to https://openrouter.ai
2. Click **Sign In** → create a free account
3. Go to https://openrouter.ai/keys
4. Click **Create Key**
5. Give it a name (e.g. "free-claude-desktop") → **Create**
6. Copy the key — it starts with `sk-or-`

In the Admin UI:
- Click **✎ Edit** on the OpenRouter card
- Paste the key in the **API Key** field
- Click **Save Key**

**Free models to try on OpenRouter:**
```
deepseek/deepseek-r1-0528:free      ← strong reasoning, completely free
meta-llama/llama-3.3-70b-instruct:free  ← Meta Llama, free tier
mistralai/mistral-7b-instruct:free  ← fast and lightweight, free
google/gemma-3-12b-it:free          ← Google Gemma, free
```

To use a free model: click **✎ Edit** on OpenRouter card → update the Model
field to one of the above → Save.

Note: free models on OpenRouter have rate limits. For heavier use, add
OpenRouter credits at https://openrouter.ai/credits.

---

### Other Providers (Optional)

| Provider | Sign Up | Key Format | Free Tier |
|----------|---------|------------|-----------|
| Groq | console.groq.com | `gsk_...` | Yes — very fast |
| OpenAI | platform.openai.com | `sk-...` | No — pay per token |
| Mistral | console.mistral.ai | random string | Limited trial |
| Anthropic | console.anthropic.com | `sk-ant-...` | No — pay per token |
| Ollama | ollama.com | No key needed | Free — runs locally |

---

### After adding a key

1. Click **✎ Edit** on the provider card
2. Paste key in the **API Key** field
3. Click **Save Key** — takes effect immediately
4. Click **▶ Use This** — proxy verifies the key works, then switches

If the key is wrong or expired, the verify step will show the error
and keep your current working provider active.

---

## Setup (First Time)

### 1. Clone
```powershell
git clone https://github.com/chaithruak/free-claude-desktop.git
cd free-claude-desktop
```

### 2. Install dependencies
```powershell
npm install
```

### 3. Add API keys
```powershell
copy .env.example .env
notepad .env
```
Add at minimum your NVIDIA key. Also add `ANTHROPIC_API_KEY` if you want
to switch back to real Claude from the Admin UI without any other steps.

### 4. Build
```powershell
npx tsc
```

### 5. Route Claude Desktop through the proxy (Admin PowerShell — one time only)
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", "http://127.0.0.1:8082", "Machine")
```
This is a one-time step. It tells Claude Desktop to send all traffic through
the proxy. You set it once and never touch it again. After this, the Admin UI
is your only control panel for switching providers.

### 6. Install auto-start service (Admin PowerShell — one time only)
```powershell
.\install-service.ps1
```
Registers the proxy as a Windows Task Scheduler job that starts automatically
at every login. After this you never need to manually start the proxy — it is
always running in the background.

### 7. Restart Claude Desktop
Quit from the system tray, reopen. Done.

---

## Daily Usage

Open Claude Desktop and use it normally. That is it.

To switch providers: open http://127.0.0.1:8082/admin in your browser and
click **Use This** on any provider card. The switch is verified and applied
instantly — no restart needed.

---

## Switching Between Providers

All switching happens in the Admin UI at http://127.0.0.1:8082/admin.

- Click **▶ Use This** on any provider card
- The proxy tests the provider first, then switches if it passes
- Active provider shown with green border and checkmark
- Real Claude (Anthropic) shown with orange REAL CLAUDE badge

No env var changes. No Claude Desktop restarts. Ever.

---

## How to Validate Which Model is Running

| Method | How |
|--------|-----|
| Admin UI status bar | Shows active provider and model at top of page |
| Proxy console | Each request prints provider + model + token counts |
| Health endpoint | `Invoke-RestMethod http://127.0.0.1:8082/health` |
| Request Log tab | Full history in Admin UI |

---

## Auto-Start Service

### Install (run once as Admin)
```powershell
.\install-service.ps1
```
Proxy starts automatically at every Windows login. Restarts itself if it crashes.

### Check service status
```powershell
Get-ScheduledTask -TaskName "FreeClaudeDesktop" | Select-Object TaskName, State
```

### Uninstall
```powershell
.\uninstall-service.ps1
```

---

## Billing

| Active Provider | What gets billed |
|----------------|-----------------|
| NVIDIA / Groq / Ollama / etc | That provider only. Zero Anthropic charges. |
| Real Claude (Anthropic card) | Your Anthropic API key (pay-per-token, not subscription) |

---

## Project Structure

```
free-claude-desktop/
├── src/
│   └── index.ts              <- proxy server, admin API, SSE streaming
├── public/
│   └── admin.html            <- Admin UI (single file, no dependencies)
├── dist/                     <- compiled output (auto-generated by npx tsc)
├── config.json               <- auto-created on first run, stores provider config
├── .env                      <- your API keys (never committed to git)
├── .env.example              <- key template
├── install-service.ps1       <- register proxy as Windows auto-start service
├── uninstall-service.ps1     <- remove the service
├── start.ps1                 <- manual start (if not using service)
├── launch-with-proxy.ps1     <- per-session launcher with proxy
├── launch-normal.ps1         <- per-session launcher without proxy
├── SETUP.md                  <- detailed step-by-step setup guide
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "We couldn't connect to Claude" | Proxy not running. Run `.\install-service.ps1` once to fix permanently. |
| EADDRINUSE :8082 | Another proxy on the port. `netstat -ano \| findstr :8082` then `Stop-Process -Id <PID> -Force` |
| Admin page blank or wrong UI | Old proxy serving it. Kill it, start ours: `node dist\index.js` |
| Provider switch fails | Check API key is set in `.env` and restart proxy |
| Build error — cannot find node types | `npm install --save-dev @types/node` then `npx tsc` |
