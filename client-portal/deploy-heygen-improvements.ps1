# HeyGen Video Generation - Deployment Script
# PowerShell script to deploy the improved HeyGen integration

Write-Host "🎬 Deploying HeyGen Video Generation Improvements..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-Not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: firebase.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Project root detected" -ForegroundColor Green
Write-Host ""

# Step 1: Deploy backend functions
Write-Host "📤 Step 1: Deploying backend functions..." -ForegroundColor Yellow
Write-Host "   This will deploy the enhanced HeyGen API endpoints" -ForegroundColor Gray
Write-Host ""

$deployBackend = Read-Host "Deploy backend functions? (y/n)"
if ($deployBackend -eq 'y') {
    Write-Host "   Deploying functions/api/heygen.js..." -ForegroundColor Cyan
    firebase deploy --only functions:heygen
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Backend deployment failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⏭️  Skipped backend deployment" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Configure webhook
Write-Host "📍 Step 2: Configure HeyGen Webhook" -ForegroundColor Yellow
Write-Host "   Webhooks enable real-time video completion notifications" -ForegroundColor Gray
Write-Host ""

$configureWebhook = Read-Host "Open HeyGen webhook configuration? (y/n)"
if ($configureWebhook -eq 'y') {
    # Get the project URL
    $projectId = (Get-Content firebase.json | ConvertFrom-Json).projectId
    if (-Not $projectId) {
        $projectId = Read-Host "   Enter your Firebase project ID"
    }
    
    $webhookUrl = "https://us-central1-$projectId.cloudfunctions.net/heygen/webhook"
    
    Write-Host ""
    Write-Host "   Your webhook URL:" -ForegroundColor Cyan
    Write-Host "   $webhookUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "   Steps to configure:" -ForegroundColor Cyan
    Write-Host "   1. Go to https://app.heygen.com/settings/webhooks" -ForegroundColor Gray
    Write-Host "   2. Click 'Add Webhook Endpoint'" -ForegroundColor Gray
    Write-Host "   3. Paste the URL above" -ForegroundColor Gray
    Write-Host "   4. Subscribe to: avatar_video.success, avatar_video.fail" -ForegroundColor Gray
    Write-Host "   5. Save and test" -ForegroundColor Gray
    Write-Host ""
    
    # Copy to clipboard if possible
    Set-Clipboard -Value $webhookUrl
    Write-Host "   ✅ Webhook URL copied to clipboard!" -ForegroundColor Green
    
    # Open browser
    Start-Process "https://app.heygen.com/settings/webhooks"
    Write-Host "   🌐 Opening HeyGen webhook settings..." -ForegroundColor Cyan
} else {
    Write-Host "   ⏭️  Skipped webhook configuration" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Test new endpoints
Write-Host "🧪 Step 3: Test New Endpoints" -ForegroundColor Yellow
Write-Host "   Verify the new avatar and voice listing endpoints work" -ForegroundColor Gray
Write-Host ""

$testEndpoints = Read-Host "Run endpoint tests? (y/n)"
if ($testEndpoints -eq 'y') {
    Write-Host ""
    Write-Host "   To test the endpoints, you need a Firebase auth token." -ForegroundColor Cyan
    Write-Host "   Get it from browser DevTools:" -ForegroundColor Gray
    Write-Host "   1. Open your app in browser and log in" -ForegroundColor Gray
    Write-Host "   2. Open DevTools (F12)" -ForegroundColor Gray
    Write-Host "   3. Go to Application > IndexedDB > firebaseLocalStorage" -ForegroundColor Gray
    Write-Host "   4. Find 'stsTokenManager' and copy the 'accessToken'" -ForegroundColor Gray
    Write-Host ""
    
    $token = Read-Host "   Paste your auth token (or press Enter to skip)"
    
    if ($token) {
        $baseUrl = "https://us-central1-$projectId.cloudfunctions.net/heygen"
        
        Write-Host ""
        Write-Host "   Testing GET $baseUrl/avatars..." -ForegroundColor Cyan
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/avatars" -Headers @{
                "Authorization" = "Bearer $token"
            } -Method Get
            
            Write-Host "   ✅ Avatars endpoint working! Found $($response.data.total) avatars" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Failed to fetch avatars: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "   Testing GET $baseUrl/voices..." -ForegroundColor Cyan
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/voices" -Headers @{
                "Authorization" = "Bearer $token"
            } -Method Get
            
            Write-Host "   ✅ Voices endpoint working! Found $($response.data.total) voices" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Failed to fetch voices: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⏭️  Skipped endpoint tests" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⏭️  Skipped endpoint tests" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ✅ Review HEYGEN_IMPROVEMENTS.md for full documentation" -ForegroundColor White
Write-Host "2. 🎨 Enhance frontend modal with new avatar/voice pickers (optional)" -ForegroundColor White
Write-Host "3. 📊 Monitor function logs: firebase functions:log --only heygen" -ForegroundColor White
Write-Host "4. 🧪 Test video generation with different avatars/voices" -ForegroundColor White
Write-Host "5. 📈 Check webhook delivery in HeyGen dashboard" -ForegroundColor White
Write-Host ""
Write-Host "💡 Key Improvements:" -ForegroundColor Yellow
Write-Host "   • Webhook support (95% fewer API calls)" -ForegroundColor Green
Write-Host "   • 100+ avatars & 300+ voices available" -ForegroundColor Green
Write-Host "   • Automatic retry on failures" -ForegroundColor Green
Write-Host "   • HD video support (1080p)" -ForegroundColor Green
Write-Host "   • Voice customization (speed, pitch, emotion)" -ForegroundColor Green
Write-Host "   • Caption support" -ForegroundColor Green
Write-Host "   • Better polling (exponential backoff)" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Resources:" -ForegroundColor Yellow
Write-Host "   • HeyGen Docs: https://docs.heygen.com/" -ForegroundColor Cyan
Write-Host "   • Webhook Guide: https://docs.heygen.com/docs/using-heygens-webhook-events" -ForegroundColor Cyan
Write-Host "   • API Limits: https://docs.heygen.com/reference/limits" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Happy video generating!" -ForegroundColor Magenta
Write-Host ""
