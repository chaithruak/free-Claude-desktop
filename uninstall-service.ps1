# uninstall-service.ps1
# Removes the auto-start service. Run as Administrator.

$taskName = "FreeClaudeDesktop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run this script as Administrator." -ForegroundColor Red
    exit 1
}

# Stop any running proxy on 8082
$conn = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Stopping proxy on port 8082 (PID $($conn.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}

# Remove task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "Service uninstalled." -ForegroundColor Green
Write-Host "Claude Desktop will use real Anthropic on next launch." -ForegroundColor Cyan
