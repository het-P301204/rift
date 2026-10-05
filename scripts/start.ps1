# RIFT startup script (Windows PowerShell)
Write-Host "Starting RIFT — HTTP Desync Research Platform" -ForegroundColor Cyan
Write-Host ""

# Start API
Write-Host "Starting API server on :8000..." -ForegroundColor Yellow
$api = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Set-Location 'H:\CLAUDE\DAILY PROJECTS - R\rift\apps\api'; .\venv\Scripts\uvicorn main:app --reload --port 8000" `
  -PassThru

Start-Sleep 2

# Start Frontend
Write-Host "Starting frontend on :5173..." -ForegroundColor Yellow
$web = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Set-Location 'H:\CLAUDE\DAILY PROJECTS - R\rift\apps\web'; npm run dev" `
  -PassThru

Write-Host ""
Write-Host "RIFT is starting up." -ForegroundColor Green
Write-Host "  API:      http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
