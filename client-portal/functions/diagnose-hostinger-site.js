#!/usr/bin/env node

/**
 * Hostinger Site Diagnostic Tool
 * Comprehensive analysis of site accessibility and security blocks
 */

const axios = require('axios');

const SITE_URL = 'https://darkslategray-jay-130886.hostingersite.com';

async function diagnoseHostingerSite() {
    console.log('🔍 Hostinger Site Diagnostic Analysis\n');
    
    console.log('📋 Target Site:', SITE_URL);
    console.log('');
    
    // Test 1: Basic site access with different user agents
    console.log('1️⃣ Testing site access with different user agents...');
    
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'WordPress/6.0; ' + SITE_URL,
        'curl/7.68.0',
        'PostmanRuntime/7.28.0',
        'axios/0.21.1'
    ];
    
    for (const userAgent of userAgents) {
        try {
            const response = await axios.get(SITE_URL, {
                headers: { 'User-Agent': userAgent },
                timeout: 10000
            });
            console.log(`   ✅ ${userAgent.substring(0, 30)}... - Status: ${response.status}`);
        } catch (error) {
            console.log(`   ❌ ${userAgent.substring(0, 30)}... - Error: ${error.response?.status || error.message}`);
        }
    }
    
    console.log('');
    
    // Test 2: Check if it's a geographic restriction
    console.log('2️⃣ Testing different request methods...');
    
    const methods = ['GET', 'HEAD', 'OPTIONS'];
    for (const method of methods) {
        try {
            const response = await axios({
                method: method,
                url: SITE_URL,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            console.log(`   ✅ ${method} - Status: ${response.status}`);
        } catch (error) {
            console.log(`   ❌ ${method} - Error: ${error.response?.status || error.message}`);
        }
    }
    
    console.log('');
    
    // Test 3: Check common WordPress paths
    console.log('3️⃣ Testing WordPress-specific paths...');
    
    const wpPaths = [
        '/wp-admin/',
        '/wp-login.php',
        '/wp-content/',
        '/wp-includes/',
        '/wp-json/',
        '/wp-json/wp/v2/',
        '/xmlrpc.php',
        '/robots.txt',
        '/sitemap.xml'
    ];
    
    for (const path of wpPaths) {
        try {
            const response = await axios.get(SITE_URL + path, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000,
                maxRedirects: 0,
                validateStatus: (status) => status < 500 // Accept redirects and client errors
            });
            console.log(`   ✅ ${path} - Status: ${response.status}`);
        } catch (error) {
            if (error.response) {
                console.log(`   ⚠️  ${path} - Status: ${error.response.status}`);
            } else {
                console.log(`   ❌ ${path} - Error: ${error.message}`);
            }
        }
    }
    
    console.log('');
    
    // Test 4: Check response headers for security info
    console.log('4️⃣ Analyzing security headers...');
    
    try {
        const response = await axios.get(SITE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
            validateStatus: () => true // Accept any status
        });
        
        console.log(`   Response Status: ${response.status}`);
        console.log(`   Server: ${response.headers.server || 'Not disclosed'}`);
        console.log(`   X-Powered-By: ${response.headers['x-powered-by'] || 'Not disclosed'}`);
        console.log(`   CF-Ray: ${response.headers['cf-ray'] || 'Not using Cloudflare'}`);
        console.log(`   X-Frame-Options: ${response.headers['x-frame-options'] || 'Not set'}`);
        console.log(`   Content-Security-Policy: ${response.headers['content-security-policy'] || 'Not set'}`);
        
        if (response.status === 403) {
            console.log('\n   🚨 403 Forbidden Analysis:');
            if (response.data && typeof response.data === 'string') {
                if (response.data.includes('Cloudflare')) {
                    console.log('   - Blocked by Cloudflare security');
                } else if (response.data.includes('mod_security') || response.data.includes('ModSecurity')) {
                    console.log('   - Blocked by ModSecurity (server firewall)');
                } else if (response.data.includes('Forbidden')) {
                    console.log('   - Generic server-level block');
                } else if (response.data.includes('Hostinger')) {
                    console.log('   - Hostinger-specific security block');
                }
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Could not analyze headers: ${error.message}`);
    }
    
    console.log('\n📋 **Diagnostic Summary:**');
    console.log('');
    
    console.log('🔍 **Possible Issues:**');
    console.log('   1. **IP-based blocking** - Your IP might be blacklisted');
    console.log('   2. **Geographic restrictions** - Site might block certain regions');
    console.log('   3. **User-Agent filtering** - Server blocks automated requests');
    console.log('   4. **Cloudflare protection** - If using Cloudflare security');
    console.log('   5. **Hostinger security** - Default security blocking API access');
    console.log('   6. **Site maintenance** - Site might be in maintenance mode');
    console.log('');
    
    console.log('✅ **Solutions to Try:**');
    console.log('   1. **Access from browser** - Try opening the site in a web browser');
    console.log('   2. **Contact Hostinger** - Ask them to whitelist your IP');
    console.log('   3. **Check Cloudflare** - If using CF, adjust security settings');
    console.log('   4. **WordPress admin** - Try accessing /wp-admin/ directly');
    console.log('   5. **Different network** - Test from a different internet connection');
    console.log('   6. **VPN/Proxy** - Try connecting through a different location');
    console.log('');
    
    console.log('🎯 **Next Steps:**');
    console.log('   1. Try accessing the site in your web browser');
    console.log('   2. If browser works, the issue is automated request blocking');
    console.log('   3. Contact Hostinger support with this diagnostic info');
    console.log('   4. Ask them to enable API access for your IP address');
}

// Run the diagnostic
diagnoseHostingerSite().catch(console.error);