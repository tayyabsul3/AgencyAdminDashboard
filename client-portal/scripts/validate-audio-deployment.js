#!/usr/bin/env node

/**
 * Audio Interview Features Deployment Validation Script
 * Validates that all components are properly configured for production
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Missing: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ ${description} - File not found: ${filePath}`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(searchText)) {
      log(`✅ ${description}`, 'green');
      return true;
    } else {
      log(`❌ ${description} - Content not found in ${filePath}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ${description} - Error reading ${filePath}: ${error.message}`, 'red');
    return false;
  }
}

function validateEnvironmentTemplate(filePath, requiredVars) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ Environment template missing: ${filePath}`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    let allFound = true;
    
    for (const varName of requiredVars) {
      if (content.includes(varName)) {
        log(`  ✅ ${varName}`, 'green');
      } else {
        log(`  ❌ ${varName}`, 'red');
        allFound = false;
      }
    }
    
    return allFound;
  } catch (error) {
    log(`❌ Error validating ${filePath}: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🔍 Validating Audio Interview Features Deployment Configuration', 'cyan');
  log('================================================================', 'cyan');

  let allChecksPass = true;

  // 1. Check Core Files
  log('\n📁 Checking Core Files...', 'yellow');
  allChecksPass &= checkFile('package.json', 'Package.json exists');
  allChecksPass &= checkFile('firebase.json', 'Firebase configuration exists');
  allChecksPass &= checkFile('.firebaserc', 'Firebase project configuration exists');
  allChecksPass &= checkFile('functions/package.json', 'Functions package.json exists');
  allChecksPass &= checkFile('functions/index.js', 'Functions entry point exists');

  // 2. Check Environment Configuration
  log('\n🔧 Checking Environment Configuration...', 'yellow');
  allChecksPass &= checkFile('.env.example', 'Environment example file exists');
  allChecksPass &= checkFile('.env.production.example', 'Production environment example exists');
  
  const requiredEnvVars = [
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'ELEVENLABS_RATE_LIMIT_REQUESTS_PER_MINUTE',
    'ELEVENLABS_RATE_LIMIT_CHARACTERS_PER_MINUTE',
    'ELEVENLABS_USAGE_TRACKING_ENABLED',
    'ELEVENLABS_CACHE_ENABLED',
    'NEXT_PUBLIC_AUDIO_FEATURES_ENABLED',
    'NEXT_PUBLIC_VOICE_INTERVIEW_ENABLED'
  ];
  
  log('  Validating .env.production.example:', 'blue');
  allChecksPass &= validateEnvironmentTemplate('.env.production.example', requiredEnvVars);

  // 3. Check Audio Services
  log('\n🎵 Checking Audio Services...', 'yellow');
  allChecksPass &= checkFile('src/services/speechService.js', 'Speech service exists');
  allChecksPass &= checkFile('src/services/elevenLabsService.js', 'ElevenLabs service exists');
  allChecksPass &= checkFile('src/services/audioManager.js', 'Audio manager exists');
  allChecksPass &= checkFile('src/services/gracefulDegradationService.js', 'Graceful degradation service exists');
  allChecksPass &= checkFile('src/services/audioErrorHandler.js', 'Audio error handler exists');

  // 4. Check Audio Components
  log('\n🎤 Checking Audio Components...', 'yellow');
  allChecksPass &= checkFile('src/components/interview/VoiceInterviewInterface.js', 'Voice interview interface exists');
  allChecksPass &= checkFile('src/components/interview/AudioControls.js', 'Audio controls component exists');
  allChecksPass &= checkFile('src/components/audio/AudioErrorManager.js', 'Audio error manager exists');
  allChecksPass &= checkFile('src/components/audio/MicrophoneTestModal.js', 'Microphone test modal exists');

  // 5. Check Firebase Functions
  log('\n🔥 Checking Firebase Functions...', 'yellow');
  allChecksPass &= checkFile('functions/api/elevenlabs.js', 'ElevenLabs API function exists');
  allChecksPass &= checkFile('functions/lib/rateLimiter.js', 'Rate limiter exists');
  allChecksPass &= checkFile('functions/lib/usageMonitor.js', 'Usage monitor exists');
  allChecksPass &= checkFile('functions/lib/audioCache.js', 'Audio cache exists');

  // 6. Check API Routes Content
  log('\n🌐 Checking API Routes Content...', 'yellow');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'handleSynthesize', 'ElevenLabs synthesize handler');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'handleUsage', 'ElevenLabs usage handler');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'handleHealth', 'ElevenLabs health handler');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'rateLimiter', 'Rate limiting integration');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'usageMonitor', 'Usage monitoring integration');
  allChecksPass &= checkFileContent('functions/api/elevenlabs.js', 'audioCache', 'Audio caching integration');

  // 7. Check Production Features
  log('\n🏭 Checking Production Features...', 'yellow');
  allChecksPass &= checkFileContent('functions/lib/rateLimiter.js', 'checkRateLimit', 'Rate limiting implementation');
  allChecksPass &= checkFileContent('functions/lib/usageMonitor.js', 'recordSuccess', 'Usage tracking implementation');
  allChecksPass &= checkFileContent('functions/lib/audioCache.js', 'generateCacheKey', 'Audio caching implementation');

  // 8. Check Health Monitoring
  log('\n🏥 Checking Health Monitoring...', 'yellow');
  allChecksPass &= checkFile('src/app/health/page.js', 'Health dashboard exists');
  allChecksPass &= checkFileContent('src/app/health/page.js', 'checkElevenLabsHealth', 'ElevenLabs health check');
  allChecksPass &= checkFileContent('src/app/health/page.js', 'checkElevenLabsUsage', 'ElevenLabs usage check');
  allChecksPass &= checkFileContent('src/app/health/page.js', 'productionSection', 'Production monitoring section');

  // 9. Check Deployment Scripts
  log('\n🚀 Checking Deployment Scripts...', 'yellow');
  allChecksPass &= checkFile('scripts/deploy-production.js', 'Production deployment script exists');
  allChecksPass &= checkFileContent('scripts/deploy-production.js', 'ELEVENLABS_API_KEY', 'ElevenLabs configuration in deployment');
  allChecksPass &= checkFileContent('package.json', 'deploy:audio-production', 'Audio production deployment command');

  // 10. Check Documentation
  log('\n📚 Checking Documentation...', 'yellow');
  allChecksPass &= checkFile('PRODUCTION_AUDIO_DEPLOYMENT_GUIDE.md', 'Production deployment guide exists');
  allChecksPass &= checkFileContent('PRODUCTION_AUDIO_DEPLOYMENT_GUIDE.md', 'ElevenLabs API Setup', 'ElevenLabs setup documentation');
  allChecksPass &= checkFileContent('PRODUCTION_AUDIO_DEPLOYMENT_GUIDE.md', 'Rate Limiting', 'Rate limiting documentation');
  allChecksPass &= checkFileContent('PRODUCTION_AUDIO_DEPLOYMENT_GUIDE.md', 'Usage Monitoring', 'Usage monitoring documentation');

  // 11. Check Build Configuration
  log('\n🔨 Checking Build Configuration...', 'yellow');
  allChecksPass &= checkFileContent('firebase.json', 'functions', 'Firebase Functions configuration');
  allChecksPass &= checkFileContent('firebase.json', 'hosting', 'Firebase Hosting configuration');
  allChecksPass &= checkFileContent('firebase.json', 'rewrites', 'API routing configuration');

  // 12. Check CSS and Styling
  log('\n🎨 Checking CSS and Styling...', 'yellow');
  allChecksPass &= checkFile('src/app/health/HealthCheck.module.css', 'Health dashboard CSS exists');
  allChecksPass &= checkFileContent('src/app/health/HealthCheck.module.css', 'productionSection', 'Production monitoring CSS');
  allChecksPass &= checkFileContent('src/app/health/HealthCheck.module.css', 'monitoringCard', 'Monitoring card CSS');

  // 13. Validate Package Dependencies
  log('\n📦 Checking Package Dependencies...', 'yellow');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const functionsPackageJson = JSON.parse(fs.readFileSync('functions/package.json', 'utf8'));
    
    // Check main dependencies
    const requiredDeps = ['next', 'react', 'firebase'];
    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        log(`  ✅ ${dep}`, 'green');
      } else {
        log(`  ❌ ${dep}`, 'red');
        allChecksPass = false;
      }
    }
    
    // Check functions dependencies
    const requiredFunctionsDeps = ['firebase-functions', 'firebase-admin', 'node-fetch'];
    for (const dep of requiredFunctionsDeps) {
      if (functionsPackageJson.dependencies && functionsPackageJson.dependencies[dep]) {
        log(`  ✅ functions/${dep}`, 'green');
      } else {
        log(`  ❌ functions/${dep}`, 'red');
        allChecksPass = false;
      }
    }
  } catch (error) {
    log(`❌ Error checking package dependencies: ${error.message}`, 'red');
    allChecksPass = false;
  }

  // Final Results
  log('\n' + '='.repeat(60), 'cyan');
  if (allChecksPass) {
    log('🎉 All validation checks passed!', 'green');
    log('✅ Audio interview features are ready for production deployment', 'green');
    log('\nNext steps:', 'blue');
    log('1. Set up your production environment variables', 'blue');
    log('2. Configure ElevenLabs API key and voice ID', 'blue');
    log('3. Run: npm run deploy:audio-production', 'blue');
    log('4. Test the deployment using the health dashboard', 'blue');
  } else {
    log('❌ Some validation checks failed!', 'red');
    log('⚠️  Please fix the issues above before deploying to production', 'yellow');
    process.exit(1);
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  log(`\n❌ Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\n❌ Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

// Run the validation
main().catch((error) => {
  log(`\n❌ Validation failed: ${error.message}`, 'red');
  process.exit(1);
});