/**
 * Detailed Site Analysis for xovotech.shop
 */

const axios = require('axios');

async function analyzeSite() {
  const siteUrl = 'https://xovotech.shop';
  
  console.log('🔍 Detailed Analysis of xovotech.shop\n');
  
  // Test 1: Check what the site actually returns
  console.log('1️⃣ Analyzing site content...');
  try {
    const response = await axios.get(siteUrl, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    
    const html = response.data.toLowerCase();
    
    // Check for WordPress indicators
    const wpIndicators = [
      'wp-content',
      'wp-includes', 
      'wordpress',
      '/wp-json/',
      'wp-admin',
      'wp_enqueue_script',
      'wp-embed',
      'rest_url'
    ];
    
    const foundIndicators = wpIndicators.filter(indicator => html.includes(indicator));
    
    if (foundIndicators.length > 0) {
      console.log('   ✅ WordPress indicators found:', foundIndicators);
    } else {
      console.log('   ❌ No WordPress indicators found');
      console.log('   🔍 Site appears to be:', detectSiteType(html, response.headers));
    }
    
    // Check for REST API links in HTML
    const restApiMatch = html.match(/https?:\/\/[^"']+\/wp-json[^"']*/);
    if (restApiMatch) {
      console.log('   ✅ REST API URL found in HTML:', restApiMatch[0]);
    }
    
  } catch (error) {
    console.log(`   ❌ Failed to analyze site: ${error.message}`);
    return;
  }
  
  // Test 2: Check common WordPress paths
  console.log('\n2️⃣ Testing WordPress-specific paths...');
  
  const pathsToTest = [
    '/wp-admin/',
    '/wp-login.php',
    '/wp-content/',
    '/wp-includes/',
    '/xmlrpc.php',
    '/wp-json/',
    '/wp-json/wp/v2/',
    '/?rest_route=/',
    '/?rest_route=/wp/v2'
  ];
  
  for (const path of pathsToTest) {
    const fullUrl = siteUrl + path;
    console.log(`   Testing: ${path}`);
    
    try {
      const response = await axios.get(fullUrl, { 
        timeout: 5000,
        validateStatus: (status) => status < 500,
        headers: {
          'User-Agent': 'WordPress-API-Test/1.0'
        }
      });
      
      if (response.status === 200) {
        console.log(`     ✅ Accessible (${response.status})`);
        if (path.includes('wp-json') || path.includes('rest_route')) {
          console.log(`     📄 Content type: ${response.headers['content-type']}`);
          if (response.headers['content-type']?.includes('json')) {
            console.log(`     🎯 Valid JSON response!`);
          }
        }
      } else if (response.status === 301 || response.status === 302) {
        console.log(`     🔄 Redirect (${response.status}) to: ${response.headers.location}`);
      } else if (response.status === 401) {
        console.log(`     🔒 Requires authentication (${response.status})`);
      } else if (response.status === 403) {
        console.log(`     🚫 Forbidden (${response.status})`);
      } else {
        console.log(`     ⚠️  Status: ${response.status}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`     ❌ ${error.response.status}: ${error.response.statusText}`);
      } else {
        console.log(`     ❌ ${error.message}`);
      }
    }
  }
  
  // Test 3: Check if WordPress is in a subdirectory
  console.log('\n3️⃣ Checking for WordPress in subdirectories...');
  
  const subdirs = ['blog', 'wordpress', 'wp', 'site', 'cms'];
  
  for (const subdir of subdirs) {
    const subdirUrl = `${siteUrl}/${subdir}`;
    console.log(`   Testing: /${subdir}/`);
    
    try {
      const response = await axios.get(subdirUrl, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.status === 200) {
        const html = response.data.toLowerCase();
        if (html.includes('wp-content') || html.includes('wordpress')) {
          console.log(`     ✅ WordPress found in /${subdir}/!`);
          
          // Test REST API in subdirectory
          const restUrl = `${subdirUrl}/wp-json/wp/v2`;
          try {
            const restResponse = await axios.get(restUrl, { timeout: 5000 });
            console.log(`     🎯 REST API working: ${restUrl}`);
          } catch (e) {
            console.log(`     ❌ REST API not accessible in subdirectory`);
          }
        }
      }
    } catch (error) {
      // Subdirectory doesn't exist, continue
    }
  }
  
  // Test 4: Check server headers for clues
  console.log('\n4️⃣ Server information...');
  try {
    const response = await axios.head(siteUrl, { timeout: 5000 });
    console.log(`   Server: ${response.headers.server || 'Unknown'}`);
    console.log(`   X-Powered-By: ${response.headers['x-powered-by'] || 'Not disclosed'}`);
    
    // Check for WordPress-specific headers
    const wpHeaders = ['x-pingback', 'link'];
    wpHeaders.forEach(header => {
      if (response.headers[header]) {
        console.log(`   ${header}: ${response.headers[header]}`);
      }
    });
    
  } catch (error) {
    console.log(`   ❌ Could not get server headers: ${error.message}`);
  }
  
  console.log('\n📋 Summary and Recommendations:');
  console.log('   Based on the analysis above:');
  console.log('   1. If no WordPress indicators were found, this might not be a WordPress site');
  console.log('   2. If WordPress was found in a subdirectory, use that URL instead');
  console.log('   3. If REST API paths are blocked, contact your hosting provider');
  console.log('   4. Some hosts disable REST API for security - check hosting settings');
}

function detectSiteType(html, headers) {
  if (html.includes('shopify')) return 'Shopify store';
  if (html.includes('wix')) return 'Wix site';
  if (html.includes('squarespace')) return 'Squarespace site';
  if (html.includes('webflow')) return 'Webflow site';
  if (html.includes('drupal')) return 'Drupal site';
  if (html.includes('joomla')) return 'Joomla site';
  if (headers.server?.includes('nginx')) return 'Static site (Nginx)';
  if (headers.server?.includes('apache')) return 'Apache server';
  return 'Unknown platform';
}

analyzeSite().catch(console.error);