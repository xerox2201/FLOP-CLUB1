Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\projects\poker-platform\apps\server'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\projects\poker-platform\apps\mini-app'; npm run dev"

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Backend:  http://localhost:4000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "Ali:  http://localhost:5173/?uid=111&name=Ali" -ForegroundColor Yellow
Write-Host "Sara: http://localhost:5173/?uid=222&name=Sara" -ForegroundColor Yellow