# launch-normal.ps1
# Launches Claude Desktop with a guaranteed-clean Anthropic session (no proxy).

Remove-Item Env:\ANTHROPIC_API_URL -ErrorAction SilentlyContinue

$claudePath = "$env:LOCALAPPDATA\AnthropicClaude\Claude.exe"
if (Test-Path $claudePath) {
    Write-Host "Launching Claude Desktop (normal - real Anthropic)..." -ForegroundColor Cyan
    Start-Process $claudePath
} else {
    Write-Host "Claude.exe not found at $claudePath" -ForegroundColor Red
}
