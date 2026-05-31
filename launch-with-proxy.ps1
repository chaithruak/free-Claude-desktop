# launch-with-proxy.ps1
# Starts the proxy only if it's not already running, then opens Claude Desktop pointed at it.

$port = 8082

$inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($inUse) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2
        Write-Host "Proxy already running (active provider: $($health.active)). Reusing it." -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Port $port is in use by something that isn't the proxy." -ForegroundColor Red
        Write-Host "Run this to see what:  netstat -ano | findstr :$port" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Starting proxy..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit","-File","$PSScriptRoot\start.ps1"

    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1 | Out-Null
            $ready = $true
            break
        } catch { }
    }
    if ($ready) {
        Write-Host "Proxy is up." -ForegroundColor Green
    } else {
        Write-Host "Proxy did not start within 15s. Check the proxy window for errors." -ForegroundColor Red
        exit 1
    }
}

$env:ANTHROPIC_API_URL = "http://127.0.0.1:$port"

$claudePath = "$env:LOCALAPPDATA\AnthropicClaude\Claude.exe"
if (Test-Path $claudePath) {
    Write-Host "Launching Claude Desktop with proxy redirect..." -ForegroundColor Cyan
    Start-Process $claudePath
} else {
    Write-Host "Claude.exe not found at $claudePath" -ForegroundColor Red
    Write-Host "Find it and update the path in this script." -ForegroundColor Yellow
}
