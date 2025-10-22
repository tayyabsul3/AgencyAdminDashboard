const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Admin Portal and Client Portal...');

try {
  // Build admin portal
  console.log('📦 Building Admin Portal...');
  execSync('npm run build', { stdio: 'inherit' });

  // Build client portal
  console.log('📦 Building Client Portal...');
  process.chdir('client-portal');
  
  // Install dependencies if needed
  if (!fs.existsSync('node_modules')) {
    console.log('📥 Installing Client Portal dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  }
  
  // Build client portal
  execSync('npm run build', { stdio: 'inherit' });
  
  // Go back to root
  process.chdir('..');
  
  // Copy client portal build to admin portal out directory
  console.log('📋 Copying Client Portal to deployment folder...');
  
  // Create client directory in out folder
  const clientOutDir = path.join('out', 'client');
  if (!fs.existsSync(clientOutDir)) {
    fs.mkdirSync(clientOutDir, { recursive: true });
  }
  
  // Copy client portal build
  execSync('xcopy "client-portal\\out\\*" "out\\client\\" /E /I /H /Y', { stdio: 'inherit' });
  
  // Fix image paths in HTML files
  console.log('🔧 Fixing image paths in HTML files...');
  
  function fixHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        fixHtmlFiles(filePath);
      } else if (file.endsWith('.html')) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Replace /images/ with /client/images/ in HTML files
        content = content.replace(/src="\/images\//g, 'src="/client/images/');
        content = content.replace(/href="\/images\//g, 'href="/client/images/');
        fs.writeFileSync(filePath, content);
      }
    });
  }
  
  fixHtmlFiles('out/client');
  
  console.log('✅ Both applications built successfully!');
  console.log('📁 Admin Portal: /out');
  console.log('📁 Client Portal: /out/client');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}