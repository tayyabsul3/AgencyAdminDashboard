# Clean and deploy both portals
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
if (Test-Path out) { Remove-Item -Recurse -Force out }
if (Test-Path client-portal\.next) { Remove-Item -Recurse -Force client-portal\.next }
if (Test-Path client-portal\out) { Remove-Item -Recurse -Force client-portal\out }

Write-Host "🚀 Building both portals..." -ForegroundColor Green
npm run build:both

Write-Host "🔥 Deploying to Firebase..." -ForegroundColor Green
firebase deploy --only hosting:agencyadmin-4f5d8

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "Admin Portal: https://your-domain.com/" -ForegroundColor Cyan
Write-Host "Client Portal: https://your-domain.com/client/" -ForegroundColor Cyan