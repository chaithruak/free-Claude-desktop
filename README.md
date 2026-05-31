# LLM Proxy for Claude Desktop

Routes Claude Desktop traffic to any LLM provider with a browser-based Admin UI.

```
Claude Desktop → http://127.0.0.1:8082 → Admin UI + Router → Your LLM
```

## Admin UI

Open `http://127.0.0.1:8082/admin` in your browser after starting the proxy.

Features:
- Switch providers with one click
- Add / edit / delete providers
- Test connection (validate API key + model)
- View request log with token usage and latency
- See API key status at a glance

## Supported Providers

| Provider | Type | Notes |
|----------|------|-------|
| NVIDIA NIM | openai-compat | 40 req/min free |
| Ollama | ollama | Local, free, no key |
| OpenAI | openai-compat | GPT-4o etc |
| Groq | openai-compat | Free tier, very fast |
| Mistral | openai-compat | European models |
| Together AI | openai-compat | Many open models |
| OpenRouter | openai-compat | 100s of models, free tier |
| Anthropic | anthropic | Fallback to real Claude |

Any OpenAI-compatible API works — LM Studio, llama.cpp, LiteLLM, Jan, etc.

---

## Requirements

- Windows 10/11
- Node.js 18+ → https://nodejs.org
- Claude Desktop installed
- API key for cloud providers you want to use

---

## Setup (First Time)

### 1. Clone
```powershell
git clone https://github.com/chaithruak/free-claude-desktop.git
cd free-claude-desktop
```

### 2. Install
```powershell
npm install
```

### 3. Create .env
```powershell
copy .env.example .env
notepad .env
```
Add API keys for providers you want. At minimum add `NVIDIA_API_KEY`.

### 4. Build
```powershell
npx tsc
```

### 5. Set system env variable (Admin PowerShell — one time only)
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", "http://127.0.0.1:8082", "Machine")
```

---

## Daily Usage

### 1. Start proxy
```powershell
.\start.ps1
```

### 2. Open Admin UI
Go to http://127.0.0.1:8082/admin in your browser.

### 3. Switch provider anytime
Click **▶ Use This** on any provider card. Takes effect immediately — no restart needed.

### 4. Open Claude Desktop and use normally

---

## Revert to Real Anthropic/Sonnet

```powershell
# Admin PowerShell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", $null, "Machine")
```
Restart Claude Desktop.

---

## Project Structure

```
free-claude-desktop/
├── src/
│   └── index.ts        ← proxy server + admin API
├── public/
│   └── admin.html      ← Admin UI (single file)
├── dist/               ← compiled (auto-generated)
├── config.json         ← auto-created on first run
├── .env                ← your API keys (never commit)
├── .env.example
├── package.json
├── tsconfig.json
├── start.ps1
└── README.md
```

---

## Adding a Custom Provider

In Admin UI → click **+ Add Provider** and fill in:
- Label: any display name
- Type: `openai-compat` for most APIs
- Base URL: the API endpoint
- Model: model identifier
- API Key Env: name of env var in your `.env`

Or edit `config.json` directly (auto-created in project root on first run).

---

## Launchers (choose proxy or normal per session)

For this to work, first remove the permanent redirect (Admin PowerShell, one time):
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", $null, "Machine")
```
Now Claude Desktop uses real Anthropic by default — no error when the proxy is off.

**Use the proxy (other LLM providers):**
```powershell
.\launch-with-proxy.ps1
```
Checks port 8082, starts the proxy only if not already running, waits until it's healthy, then opens Claude pointed at it.

**Use normal Claude (real Anthropic):**
```powershell
.\launch-normal.ps1
```
Clears the session redirect and opens Claude normally.

Note: fully quit Claude from the tray before switching, since a running instance won't pick up the per-session variable.
