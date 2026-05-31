# install-service.ps1
# Registers the proxy as a Windows Task Scheduler service that auto-starts at login.
# Run this once as Administrator.

$taskName  = "FreeClaudeDesktop"
$proxyDir  = "C:\free-claude-desktop"
$startScript = "$proxyDir\start.ps1"
$logFile   = "$proxyDir\proxy.log"

# Check we are running as admin
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run this script as Administrator." -ForegroundColor Red
    exit 1
}

# Check project exists and is built
if (-not (Test-Path "$proxyDir\dist\index.js")) {
    Write-Host "ERROR: dist\index.js not found. Run npx tsc in $proxyDir first." -ForegroundColor Red
    exit 1
}

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Build the task
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -File `"$startScript`"" `
    -WorkingDirectory $proxyDir

$trigger = New-ScheduledTaskTrigger -AtLogon

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Free Claude Desktop LLM proxy auto-start" | Out-Null

Write-Host ""
Write-Host "Service installed successfully!" -ForegroundColor Green
Write-Host "Task name : $taskName" -ForegroundColor Cyan
Write-Host "Starts    : at every Windows login" -ForegroundColor Cyan
Write-Host "Log file  : $logFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting now..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 4

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8082/health" -TimeoutSec 3
    Write-Host "Proxy is up! Active provider: $($health.active)" -ForegroundColor Green
    Write-Host "Admin UI: http://127.0.0.1:8082/admin" -ForegroundColor Cyan
} catch {
    Write-Host "Proxy may still be starting. Check proxy.log for status." -ForegroundColor Yellow
}
