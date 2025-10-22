#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates deployment configuration and environment setup
 */

const fs = require('fs');
const path = require('path');

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  
  validate() {
    console.log('🔍 Validating deployment configuration...\n');
    
    this.validateEnvironmentFiles();
    this.validateFirebaseConfig();
    this.validatePackageJson();
    this.validateSecurityRules();
    this.validateGitHubActions();
    
    this.printResults();
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }
  
  validateEnvironmentFiles() {
    console.log('📁 Checking environment files...');
    
    const requiredFiles = [
      '.env.local.example',
      '.env.production.example'
    ];
    
    requiredFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        this.errors.push(`Missing environment file: ${file}`);
      } else {
        console.log(`  ✅ ${file} exists`);
      }
    });
    
    // Check for sensitive files in git
    if (fs.existsSync('.env.local')) {
      this.warnings.push('.env.local exists - ensure it\'s in .gitignore');
    }
    
    if (fs.existsSync('.env.production')) {
      this.warnings.push('.env.production exists - ensure it\'s in .gitignore');
    }
    
    console.log();
  }
  
  validateFirebaseConfig() {
    console.log('🔥 Checking Firebase configuration...');
    
    // Check firebase.json
    if (!fs.existsSync('firebase.json')) {
      this.errors.push('Missing firebase.json configuration file');
    } else {
      try {
        const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
        
        if (!config.hosting) {
          this.errors.push('Firebase hosting configuration missing');
        } else {
          console.log('  ✅ Firebase hosting configured');
        }
        
        if (!config.functions) {
          this.warnings.push('Firebase functions configuration missing');
        } else {
          console.log('  ✅ Firebase functions configured');
        }
        
      } catch (error) {
        this.errors.push('Invalid firebase.json format');
      }
    }
    
    // Check .firebaserc
    if (!fs.existsSync('.firebaserc')) {
      this.errors.push('Missing .firebaserc project configuration');
    } else {
      try {
        const config = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
        
        if (!config.projects) {
          this.errors.push('No Firebase projects configured in .firebaserc');
        } else {
          console.log('  ✅ Firebase projects configured');
        }
        
      } catch (error) {
        this.errors.push('Invalid .firebaserc format');
      }
    }
    
    // Check Firestore rules
    if (!fs.existsSync('firestore.rules')) {
      this.errors.push('Missing firestore.rules security rules');
    } else {
      console.log('  ✅ Firestore security rules exist');
    }
    
    console.log();
  }
  
  validatePackageJson() {
    console.log('📦 Checking package.json...');
    
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check required scripts
      const requiredScripts = [
        'build',
        'build:staging',
        'build:production',
        'deploy',
        'test'
      ];
      
      requiredScripts.forEach(script => {
        if (!pkg.scripts[script]) {
          this.errors.push(`Missing npm script: ${script}`);
        } else {
          console.log(`  ✅ Script '${script}' configured`);
        }
      });
      
      // Check required dependencies
      const requiredDeps = [
        'firebase',
        'next',
        'react'
      ];
      
      requiredDeps.forEach(dep => {
        if (!pkg.dependencies[dep]) {
          this.errors.push(`Missing dependency: ${dep}`);
        }
      });
      
    } catch (error) {
      this.errors.push('Invalid package.json format');
    }
    
    console.log();
  }
  
  validateSecurityRules() {
    console.log('🔒 Checking security configuration...');
    
    // Check if security rules file exists and has content
    if (fs.existsSync('firestore.rules')) {
      const rules = fs.readFileSync('firestore.rules', 'utf8');
      
      if (rules.includes('allow read, write: if true')) {
        this.errors.push('Firestore rules allow unrestricted access - security risk!');
      } else {
        console.log('  ✅ Firestore rules appear secure');
      }
      
      if (!rules.includes('isAuthenticated()')) {
        this.warnings.push('Firestore rules may not require authentication');
      }
    }
    
    // Check for environment validation
    if (fs.existsSync('src/config/environment.js')) {
      console.log('  ✅ Environment validation configured');
    } else {
      this.warnings.push('Environment validation not configured');
    }
    
    console.log();
  }
  
  validateGitHubActions() {
    console.log('🚀 Checking CI/CD configuration...');
    
    const workflowPath = '.github/workflows/deploy.yml';
    
    if (!fs.existsSync(workflowPath)) {
      this.warnings.push('GitHub Actions deployment workflow not configured');
    } else {
      const workflow = fs.readFileSync(workflowPath, 'utf8');
      
      if (workflow.includes('secrets.')) {
        console.log('  ✅ GitHub Actions uses secrets');
      } else {
        this.warnings.push('GitHub Actions may not be using secrets properly');
      }
      
      if (workflow.includes('npm test')) {
        console.log('  ✅ GitHub Actions runs tests');
      } else {
        this.warnings.push('GitHub Actions does not run tests');
      }
    }
    
    console.log();
  }
  
  printResults() {
    console.log('📊 Validation Results:');
    console.log('='.repeat(50));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Deployment configuration looks good.');
    } else {
      if (this.errors.length > 0) {
        console.log('\n❌ Errors (must be fixed):');
        this.errors.forEach(error => console.log(`  • ${error}`));
      }
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  Warnings (should be addressed):');
        this.warnings.forEach(warning => console.log(`  • ${warning}`));
      }
    }
    
    console.log('\n📋 Deployment Checklist:');
    console.log('  □ Environment variables configured in deployment platform');
    console.log('  □ Firebase projects created (staging/production)');
    console.log('  □ GitHub secrets configured');
    console.log('  □ Domain names configured (if using custom domains)');
    console.log('  □ Monitoring and alerting set up');
    console.log('  □ Backup and recovery procedures documented');
  }
}

// Run validation
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.validate();
}

module.exports = DeploymentValidator;