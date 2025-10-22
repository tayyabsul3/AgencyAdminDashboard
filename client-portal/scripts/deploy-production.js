#!/usr/bin/env node

/**
 * Production Deployment Script for Audio Interview Features
 * Handles Firebase deployment with proper environment configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${description}...`, 'blue');
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
    return output;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description} found`, 'green');
    return true;
  } else {
    log(`❌ ${description} not found at ${filePath}`, 'red');
    return false;
  }
}

function checkEnvironmentVariable(varName, description) {
  const value = process.env[varName];
  if (value && value !== 'your_production_api_key_here' && value !== 'your_production_voice_id_here') {
    log(`✅ ${description} configured`, 'green');
    return true;
  } else {
    log(`❌ ${description} not configured (${varName})`, 'red');
    return false;
  }
}

async function main() {
  log('🚀 Starting Production Deployment for Audio Interview Features', 'cyan');
  log('================================================================', 'cyan');

  // Check prerequisites
  log('\n📋 Checking Prerequisites...', 'yellow');
  
  let allChecksPass = true;

  // Check if Firebase CLI is installed
  try {
    execSync('firebase --version', { encoding: 'utf8', stdio: 'pipe' });
    log('✅ Firebase CLI installed', 'green');
  } catch (error) {
    log('❌ Firebase CLI not installed. Run: npm install -g firebase-tools', 'red');
    allChecksPass = false;
  }

  // Check if logged into Firebase
  try {
    execSync('firebase projects:list', { encoding: 'utf8', stdio: 'pipe' });
    log('✅ Firebase authentication verified', 'green');
  } catch (error) {
    log('❌ Not logged into Firebase. Run: firebase login', 'red');
    allChecksPass = false;
  }

  // Check required files
  allChecksPass &= checkFile('.env.production', 'Production environment file');
  allChecksPass &= checkFile('functions/package.json', 'Functions package.json');
  allChecksPass &= checkFile('firebase.json', 'Firebase configuration');

  // Load production environment variables
  if (fs.existsSync('.env.production')) {
    const envContent = fs.readFileSync('.env.production', 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  }

  // Check environment variables
  log('\n🔧 Checking Environment Configuration...', 'yellow');
  allChecksPass &= checkEnvironmentVariable('ELEVENLABS_API_KEY', 'ElevenLabs API Key');
  allChecksPass &= checkEnvironmentVariable('ELEVENLABS_VOICE_ID', 'ElevenLabs Voice ID');
  allChecksPass &= checkEnvironmentVariable('GEMINI_API_KEY', 'Gemini API Key');

  if (!allChecksPass) {
    log('\n❌ Prerequisites check failed. Please fix the issues above before deploying.', 'red');
    process.exit(1);
  }

  log('\n✅ All prerequisites check passed!', 'green');

  // Set Firebase Functions environment variables
  log('\n🔧 Configuring Firebase Functions Environment...', 'yellow');
  
  const envVars = [
    { key: 'ELEVENLABS_API_KEY', value: process.env.ELEVENLABS_API_KEY },
    { key: 'ELEVENLABS_VOICE_ID', value: process.env.ELEVENLABS_VOICE_ID },
    { key: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
    { key: 'ELEVENLABS_RATE_LIMIT_REQUESTS_PER_MINUTE', value: process.env.ELEVENLABS_RATE_LIMIT_REQUESTS_PER_MINUTE || '120' },
    { key: 'ELEVENLABS_RATE_LIMIT_CHARACTERS_PER_MINUTE', value: process.env.ELEVENLABS_RATE_LIMIT_CHARACTERS_PER_MINUTE || '5000' },
    { key: 'ELEVENLABS_USAGE_TRACKING_ENABLED', value: process.env.ELEVENLABS_USAGE_TRACKING_ENABLED || 'true' },
    { key: 'ELEVENLABS_CACHE_ENABLED', value: process.env.ELEVENLABS_CACHE_ENABLED || 'true' },
    { key: 'ELEVENLABS_CACHE_TTL_SECONDS', value: process.env.ELEVENLABS_CACHE_TTL_SECONDS || '3600' }
  ];

  for (const envVar of envVars) {
    if (envVar.value) {
      try {
        execSync(`firebase functions:config:set ${envVar.key.toLowerCase().replace(/_/g, '.')}="${envVar.value}"`, { stdio: 'pipe' });
        log(`✅ Set ${envVar.key}`, 'green');
      } catch (error) {
        log(`⚠️  Warning: Could not set ${envVar.key}: ${error.message}`, 'yellow');
      }
    }
  }

  // Install dependencies
  execCommand('npm install', 'Installing root dependencies');
  execCommand('cd functions && npm install', 'Installing functions dependencies');

  // Build the project
  execCommand('npm run build', 'Building Next.js application');

  // Run tests (optional)
  const runTests = process.argv.includes('--test');
  if (runTests) {
    log('\n🧪 Running Tests...', 'yellow');
    try {
      execCommand('npm test -- --run', 'Running test suite');
    } catch (error) {
      log('⚠️  Tests failed, but continuing with deployment', 'yellow');
    }
  }

  // Deploy to Firebase
  log('\n🚀 Deploying to Firebase...', 'yellow');
  
  const deployTarget = process.argv.includes('--functions-only') ? '--only functions' : '';
  execCommand(`firebase deploy ${deployTarget}`, 'Deploying to Firebase');

  // Verify deployment
  log('\n✅ Deployment completed successfully!', 'green');
  
  // Get project info
  try {
    const projectInfo = execSync('firebase projects:list --json', { encoding: 'utf8', stdio: 'pipe' });
    const projects = JSON.parse(projectInfo);
    const currentProject = projects.find(p => p.id === process.env.FIREBASE_PROJECT_ID) || projects[0];
    
    if (currentProject) {
      log('\n🌐 Your application is now live at:', 'cyan');
      log(`   Frontend: https://${currentProject.id}.web.app`, 'blue');
      log(`   Health Dashboard: https://${currentProject.id}.web.app/health`, 'blue');
      log(`   API Base: https://us-central1-${currentProject.id}.cloudfunctions.net/api`, 'blue');
    }
  } catch (error) {
    log('\n🌐 Deployment completed! Check Firebase console for URLs.', 'cyan');
  }

  // Post-deployment verification
  log('\n🔍 Post-Deployment Verification...', 'yellow');
  log('Please verify the following:', 'blue');
  log('1. Visit the health dashboard to check all services', 'blue');
  log('2. Test voice interview functionality', 'blue');
  log('3. Monitor Firebase Functions logs for any errors', 'blue');
  log('4. Check ElevenLabs usage in their dashboard', 'blue');

  log('\n🎉 Audio Interview Features Deployment Complete!', 'green');
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

// Run the deployment
main().catch((error) => {
  log(`\n❌ Deployment failed: ${error.message}`, 'red');
  process.exit(1);
});