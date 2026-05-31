# Free Claude Desktop — Setup Guide

## What it does
Routes Claude Desktop to other LLM providers (NVIDIA, Ollama, OpenAI, Groq, etc.)
instead of Anthropic, with a browser-based admin panel to switch between them.

```
Claude Desktop  ->  Local Proxy (127.0.0.1:8082)  ->  Your chosen LLM
```

---

## Prerequisites

Check Node.js is installed (need 18+):

```powershell
node --version
```

If missing, install from https://nodejs.org with default options.

---

## Part 1 — One-Time Setup

### Step 1. Extract the project
Extract this project to `C:\free-claude-desktop`

### Step 2. Install dependencies
```powershell
cd C:\free-claude-desktop
npm install
```

### Step 3. Add your API key
```powershell
copy .env.example .env
notepad .env
```
Add your NVIDIA key (and any others you have), save, close:
```
NVIDIA_API_KEY=nvapi-your-key-here
```

### Step 4. Build
```powershell
npx tsc
```
Confirm it worked:
```powershell
ls dist\index.js
```

---

## Part 2 — Daily Usage

### Step 5. Start the proxy
```powershell
cd C:\free-claude-desktop
node dist\index.js
```
You should see:
```
==============================================
  Free Claude Desktop
  Proxy  : http://127.0.0.1:8082/v1/messages
  Admin  : http://127.0.0.1:8082/admin
==============================================
```
LEAVE THIS WINDOW OPEN. Closing it stops the proxy.

### Step 6. Point Claude Desktop at the proxy
Run ONCE in Administrator PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", "http://127.0.0.1:8082", "Machine")
```

### Step 7. Restart Claude Desktop
Quit from the system tray (not just close the window), then reopen.

### Step 8. Open the Admin UI
In your browser: http://127.0.0.1:8082/admin

Switch providers, edit models, test connections, and view the request log here.

---

## Verify It's Working

Type a message in Claude Desktop and watch the proxy window. A log line
appears for each request:
```
[timestamp] -> nvidia | stepfun-ai/step-3.7-flash (stream)
```
That confirms traffic is flowing through the proxy.

---

## Switching Back to Real Claude

When you want normal Anthropic Claude, run in Administrator PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", $null, "Machine")
```
Restart Claude Desktop. (You can leave the proxy off too.)

To go back to the proxy later, re-run the Step 6 command.

---

## Golden Rule

The redirect (Step 6) and the running proxy (Step 5) must BOTH be active
together. If the redirect is set but the proxy is not running, you get
"We couldn't connect to Claude." Either start the proxy, or remove the redirect.

---

## Optional — Cleaner Per-Session Switching

Instead of the permanent Machine-level redirect, you can switch per launch:

1. Remove the permanent redirect (Admin PowerShell, once):
   ```powershell
   [System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", $null, "Machine")
   ```
2. Use the proxy:  `.\launch-with-proxy.ps1`  (starts proxy if needed, opens Claude pointed at it)
3. Use normal Claude:  `.\launch-normal.ps1`  (opens Claude with no redirect)

Fully quit Claude from the tray before switching, since a running instance
won't pick up the per-session variable.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "We couldn't connect to Claude" | Proxy not running — do Step 5. Or remove redirect (switch-back command). |
| EADDRINUSE :8082 | Another proxy already running. Find it: `netstat -ano \| findstr :8082`, then `Stop-Process -Id <PID> -Force` (use Admin PowerShell if access denied). |
| Admin page blank / wrong UI | An old proxy is serving it. Kill it (above), start ours (Step 5), hard-refresh Ctrl+Shift+R. |
| Build error about 'node' types | `npm install --save-dev @types/node` then `npx tsc`. |
| Proxy window closes instantly | Run `node dist\index.js` directly to see the error. |

---

## Adding API Keys for Other Providers

Edit `.env` and add any of:
```
NVIDIA_API_KEY=nvapi-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
TOGETHER_API_KEY=...
OPENROUTER_API_KEY=...
```
Get keys at: build.nvidia.com | platform.openai.com | console.groq.com |
console.mistral.ai | api.together.xyz | openrouter.ai

Ollama runs locally with no key — install from https://ollama.com, then
`ollama pull llama3.2`, and switch to the Ollama provider in the Admin UI.
