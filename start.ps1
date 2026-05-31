# Load .env file
$envFile = "$PSScriptRoot\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
} else {
    Write-Host "ERROR: .env file not found. Copy .env.example to .env and add your API keys." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting LLM Proxy for Claude Desktop..." -ForegroundColor Cyan
Write-Host "Admin UI: http://127.0.0.1:8082/admin" -ForegroundColor Green
Write-Host ""
node "$PSScriptRoot\dist\index.js"
