# Free Claude Desktop — Setup Guide

## What it does

Routes Claude Desktop to any LLM provider (NVIDIA, Ollama, OpenAI, Groq, etc.)
instead of Anthropic, with a browser-based Admin UI to switch between them
instantly — no restarts, no env var changes, ever.

```
Claude Desktop -> Proxy (127.0.0.1:8082) -> Your chosen LLM
                          |
                    Admin UI controls
                    which LLM is active
```

---

## Requirements

- Windows 10/11
- Node.js 18+ — download from https://nodejs.org (install with defaults)
- Claude Desktop installed
- API key for at least one provider (NVIDIA recommended to start)

Check Node.js is installed:
```powershell
node --version
```

---

## Part 1 — One-Time Setup

### Step 1. Extract the project
Extract this zip to `C:\free-claude-desktop`

### Step 2. Install dependencies
```powershell
cd C:\free-claude-desktop
npm install
```

### Step 3. Add your API keys
```powershell
copy .env.example .env
notepad .env
```

Add your keys, save and close. At minimum add NVIDIA. Also add ANTHROPIC_API_KEY
if you want to switch back to real Claude from the Admin UI without any extra steps:
```
ANTHROPIC_API_KEY=your-key-from-console.anthropic.com
NVIDIA_API_KEY=nvapi-your-key-from-build.nvidia.com
```

### Step 4. Build the project
```powershell
npx tsc
```

Confirm it worked:
```powershell
ls dist\index.js
```

### Step 5. Route Claude Desktop through the proxy
Run in Administrator PowerShell — ONE TIME ONLY, never needs to change again:
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", "http://127.0.0.1:8082", "Machine")
```

This is a one-time door. It tells Claude Desktop to send all traffic through
the proxy. You set it once and forget it exists. From this point on, the
Admin UI at http://127.0.0.1:8082/admin is your only control panel.

### Step 6. Install the auto-start service
Run in Administrator PowerShell — ONE TIME ONLY:
```powershell
cd C:\free-claude-desktop
.\install-service.ps1
```

This registers the proxy as a Windows Task Scheduler job that:
- Starts automatically at every Windows login
- Runs silently in the background (no visible window)
- Restarts itself automatically if it crashes
- Logs output to C:\free-claude-desktop\proxy.log

After this you never need to manually start the proxy again.

You should see:
```
Service installed successfully!
Task name : FreeClaudeDesktop
Starts    : at every Windows login
Proxy is up! Active provider: nvidia
Admin UI: http://127.0.0.1:8082/admin
```

### Step 7. Restart Claude Desktop
Quit from the system tray (right-click tray icon -> Quit), then reopen.

### Step 8. Open the Admin UI
In your browser: http://127.0.0.1:8082/admin

You will see provider cards. NVIDIA should be active (green border).

---

## Part 2 — Daily Usage

Open Claude Desktop and use it normally. The proxy is always running in the
background. No manual steps needed.

To switch providers: open http://127.0.0.1:8082/admin and click Use This
on any provider card. The proxy verifies the provider works first, then
switches instantly. No Claude Desktop restart needed.

---

## Switching Providers

All switching happens in the Admin UI only.

1. Open http://127.0.0.1:8082/admin
2. Click Use This on any provider card
3. A spinner appears while the provider is tested
4. If the test passes, the switch happens instantly
5. If it fails, you stay on the current provider and see the error

Special providers:
- NVIDIA NIM — orange NVIDIA card, fast cloud inference
- Real Claude (Anthropic) — orange REAL CLAUDE badge, uses your ANTHROPIC_API_KEY
- Ollama — local free models, no internet needed

---

## How to Validate Which Model is Running

### Method 1 — Admin UI status bar (easiest)
Open http://127.0.0.1:8082/admin
The top bar always shows:
```
Active: nvidia  |  Model: stepfun-ai/step-3.7-flash
```

### Method 2 — Health check
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8082/health"
```
Returns active provider and port.

### Method 3 — Request Log
Open http://127.0.0.1:8082/admin -> Request Log tab.
Every request logged with provider, model, tokens in/out, latency, status.

### Method 4 — Proxy log file
```powershell
Get-Content C:\free-claude-desktop\proxy.log -Tail 20
```
Each request prints a line like:
```
[2026-05-31T10:23:11Z] -> nvidia | stepfun-ai/step-3.7-flash (stream)
  tokens: 24 in / 87 out
```

### Which method to use

| What you want to know | Best method |
|-----------------------|-------------|
| What is active right now | Admin UI status bar |
| What handled the last message | Request Log or proxy.log |
| Is the proxy running at all | Health check |
| Full history | Request Log tab |

Note: asking "what model are you?" in Claude Desktop chat is unreliable.
Models often report their training identity rather than the actual model
running. Always use the methods above instead.

---

## Auto-Start Service Management

### Check if service is running
```powershell
Get-ScheduledTask -TaskName "FreeClaudeDesktop" | Select-Object TaskName, State
Invoke-RestMethod -Uri "http://127.0.0.1:8082/health"
```

### Start service manually
```powershell
Start-ScheduledTask -TaskName "FreeClaudeDesktop"
```

### Stop service
```powershell
Stop-ScheduledTask -TaskName "FreeClaudeDesktop"
```

### View service logs
```powershell
Get-Content C:\free-claude-desktop\proxy.log -Tail 50
```

### Uninstall service (removes auto-start)
```powershell
.\uninstall-service.ps1
```

---

## Billing

| Active Provider | What gets billed |
|----------------|-----------------|
| NVIDIA / Groq / Ollama / etc | That provider only. Zero Anthropic charges. |
| Real Claude (Anthropic card) | Anthropic API credits (pay-per-token, not your subscription) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "We couldn't connect to Claude" | Proxy not running. Run install-service.ps1 to fix permanently, or start manually: node dist\index.js |
| EADDRINUSE :8082 | Another proxy on port. `netstat -ano \| findstr :8082` then `Stop-Process -Id <PID> -Force` in Admin PowerShell |
| Admin page blank or wrong UI | Wrong proxy serving it. Kill old one, start ours: node dist\index.js, then Ctrl+Shift+R in browser |
| Provider switch fails | Check API key is set in .env and proxy has been restarted since |
| Build error about node types | `npm install --save-dev @types/node` then `npx tsc` |
| Service installed but proxy not starting | Check proxy.log for errors: `Get-Content C:\free-claude-desktop\proxy.log` |

---

## Adding and Updating API Keys

API keys are now managed entirely in the Admin UI — no .env editing or
proxy restarts needed.

### How to add or update a key

1. Open http://127.0.0.1:8082/admin
2. Click Edit (pencil icon) on any provider card
3. Paste your API key in the API Key field
4. Click Save Key
5. Done — takes effect immediately on the next request

The key is stored in config.json (which is in .gitignore and never
committed to git). The full key is never sent back to the browser —
only the last 4 characters are shown as confirmation (e.g. ...oh5).

### Key status indicators on provider cards

- Green 🔑 ...oh5 — key saved in Admin UI (config.json)
- Orange 🔑 .env — key loaded from .env file
- Red ⚠ No key — no key set anywhere

### To clear a saved key (revert to .env fallback)

Open Edit on the provider, leave the key field blank, click Save Key.

### .env file is still supported as fallback

If you have keys in .env, they still work. The Admin UI key takes priority
over the .env key when both are set. This means you can migrate keys to
the UI gradually without breaking anything.

In Admin UI click + Add Provider and fill in:
- Label: display name
- Type: openai-compat for most APIs
- Base URL: the API endpoint
- Model: model identifier
- API Key Env: name of the variable in your .env file

Get free API keys at:
- NVIDIA: build.nvidia.com
- Groq: console.groq.com
- OpenRouter: openrouter.ai
- Together: api.together.xyz
- Ollama: ollama.com (local, no key needed)
