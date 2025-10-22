#!/usr/bin/env node

/**
 * Production Deployment Script
 * Handles environment validation, build, and deployment to Firebase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'GEMINI_API_KEY'
];

const DEPLOYMENT_ENVIRONMENTS = {
  staging: {
    project: 'staging',
    envFile: '.env.staging',
    buildCommand: 'npm run build:staging'
  },
  production: {
    project: 'production',
    envFile: '.env.production',
    buildCommand: 'npm run build:production'
  }
};

class DeploymentManager {
  constructor() {
    this.environment = process.argv[2] || 'production';
    this.config = DEPLOYMENT_ENVIRONMENTS[this.environment];
    this.startTime = Date.now();
    
    if (!this.config) {
      throw new Error(`Invalid environment: ${this.environment}. Use 'staging' or 'production'`);
    }
  }
  
  async deploy() {
    try {
      console.log(`🚀 Starting deployment to ${this.environment}...`);
      
      // Pre-deployment checks
      await this.validateEnvironment();
      await this.runTests();
      await this.validateFirebaseConfig();
      
      // Build and deploy
      await this.buildApplication();
      await this.deployToFirebase();
      
      // Post-deployment verification
      await this.verifyDeployment();
      
      const duration = Math.round((Date.now() - this.startTime) / 1000);
      console.log(`✅ Deployment completed successfully in ${duration}s`);
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }
  
  async validateEnvironment() {
    console.log('🔍 Validating environment variables...');
    
    // Check if environment file exists
    if (!fs.existsSync(this.config.envFile)) {
      throw new Error(`Environment file ${this.config.envFile} not found`);
    }
    
    // Load environment variables
    const envContent = fs.readFileSync(this.config.envFile, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    // Check required variables
    const missing = REQUIRED_ENV_VARS.filter(varName => !envVars[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Validate Firebase project ID format
    const projectId = envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!/^[a-z0-9-]+$/.test(projectId)) {
      throw new Error('Invalid Firebase project ID format');
    }
    
    console.log('✅ Environment validation passed');
  }
  
  async runTests() {
    console.log('🧪 Running tests...');
    
    try {
      // Run unit tests
      execSync('npm test -- --run --passWithNoTests', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      // Run integration tests if they exist
      if (fs.existsSync('src/__tests__/integration')) {
        execSync('npm run test:integration', { stdio: 'inherit' });
      }
      
      console.log('✅ All tests passed');
    } catch (error) {
      throw new Error('Tests failed. Deployment aborted.');
    }
  }
  
  async validateFirebaseConfig() {
    console.log('🔥 Validating Firebase configuration...');
    
    try {
      // Check if Firebase CLI is installed
      execSync('firebase --version', { stdio: 'pipe' });
      
      // Validate Firebase project
      const result = execSync('firebase projects:list --json', { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      const projects = JSON.parse(result);
      const projectExists = projects.some(p => p.projectId.includes(this.environment));
      
      if (!projectExists) {
        console.warn(`⚠️  Firebase project for ${this.environment} not found in list`);
      }
      
      console.log('✅ Firebase configuration validated');
    } catch (error) {
      throw new Error('Firebase CLI not available or configuration invalid');
    }
  }
  
  async buildApplication() {
    console.log('🏗️  Building application...');
    
    try {
      // Copy environment file
      fs.copyFileSync(this.config.envFile, '.env.local');
      
      // Run build command
      execSync(this.config.buildCommand || 'npm run build', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      // Validate build output
      if (!fs.existsSync('out') && !fs.existsSync('.next')) {
        throw new Error('Build output not found');
      }
      
      console.log('✅ Application built successfully');
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }
  
  async deployToFirebase() {
    console.log('🚀 Deploying to Firebase...');
    
    try {
      // Deploy hosting and functions
      const deployCommand = this.environment === 'production' 
        ? 'firebase deploy --only hosting,functions --project production'
        : 'firebase deploy --only hosting,functions --project staging';
      
      execSync(deployCommand, { stdio: 'inherit' });
      
      console.log('✅ Firebase deployment completed');
    } catch (error) {
      throw new Error(`Firebase deployment failed: ${error.message}`);
    }
  }
  
  async verifyDeployment() {
    console.log('🔍 Verifying deployment...');
    
    try {
      // Get deployment URL
      const hostingUrl = this.getHostingUrl();
      
      // Basic health check
      const response = await fetch(`${hostingUrl}/api/health`);
      
      if (!response.ok) {
        console.warn('⚠️  Health check failed, but deployment may still be successful');
      } else {
        console.log('✅ Deployment verification passed');
      }
      
      console.log(`🌐 Application deployed to: ${hostingUrl}`);
    } catch (error) {
      console.warn('⚠️  Deployment verification failed:', error.message);
    }
  }
  
  getHostingUrl() {
    // Read Firebase config to get hosting URL
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
      const projectId = firebaseConfig.projects[this.environment] || firebaseConfig.projects.default;
      return `https://${projectId}.web.app`;
    } catch (error) {
      return `https://your-project-${this.environment}.web.app`;
    }
  }
}

// Health check API endpoint
async function createHealthCheckEndpoint() {
  const healthCheckPath = 'src/pages/api/health.js';
  
  if (!fs.existsSync(healthCheckPath)) {
    const healthCheckCode = `
export default function handler(req, res) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
}
`;
    
    fs.writeFileSync(healthCheckPath, healthCheckCode.trim());
    console.log('✅ Health check endpoint created');
  }
}

// Main execution
if (require.main === module) {
  const deployment = new DeploymentManager();
  
  // Create health check endpoint if it doesn't exist
  createHealthCheckEndpoint();
  
  // Start deployment
  deployment.deploy().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentManager;