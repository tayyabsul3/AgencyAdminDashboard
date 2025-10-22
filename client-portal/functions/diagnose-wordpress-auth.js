#!/usr/bin/env node

/**
 * WordPress Authentication Diagnostic Tool
 * Specifically tests authentication and user endpoints
 */

const axios = require('axios');

const WORDPRESS_CONFIG = {
    siteUrl: 'https://xovotech.shop/project',
    username: 'xovotech_z3r4dn',
    applicationPassword: 'Dev@project123@@@'
};

async function diagnoseWordPressAuth() {
    console.log('🔍 WordPress Authentication Diagnostics\n');
    
    const baseUrl = WORDPRESS_CONFIG.siteUrl;
    const apiBase = `${baseUrl}/wp-json`;
    
    // Create auth header
    const auth = Buffer.from(`${WORDPRESS_CONFIG.username}:${WORDPRESS_CONFIG.applicationPassword}`).toString('base64');
    const authHeader = `Basic ${auth}`;
    
    console.log('📋 Configuration:');
    console.log(`Site URL: ${baseUrl}`);
    console.log(`API Base: ${apiBase}`);
    console.log(`Username: ${WORDPRESS_CONFIG.username}`);
    console.log(`Auth Header: Basic ${auth.substring(0, 20)}...`);
    console.log('');
    
    // Test 1: Basic API discovery
    console.log('1️⃣ Testing API discovery...');
    try {
        const response = await axios.get(`${apiBase}/wp/v2`);
        console.log(`✅ API Base accessible (${response.status})`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        if (response.data && typeof response.data === 'object') {
            console.log('📄 API Response type: JSON object');
            if (response.data.routes) {
                console.log(`🛣️  Available routes: ${Object.keys(response.data.routes).length}`);
                
                // Check for user-related routes
                const userRoutes = Object.keys(response.data.routes).filter(route => 
                    route.includes('users') || route.includes('me')
                );
                console.log(`👤 User-related routes: ${userRoutes.length}`);
                userRoutes.forEach(route => console.log(`   - ${route}`));
            }
        }
    } catch (error) {
        console.log(`❌ API Base failed: ${error.message}`);
        return;
    }
    
    console.log('');
    
    // Test 2: Test users endpoint without auth
    console.log('2️⃣ Testing users endpoint (no auth)...');
    try {
        const response = await axios.get(`${apiBase}/wp/v2/users`);
        console.log(`✅ Users endpoint accessible (${response.status})`);
        console.log(`Users found: ${response.data ? response.data.length : 'unknown'}`);
    } catch (error) {
        console.log(`⚠️  Users endpoint: ${error.response?.status || error.message}`);
        if (error.response?.data) {
            console.log(`   Error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
        }
    }
    
    console.log('');
    
    // Test 3: Test authentication with /users/me
    console.log('3️⃣ Testing authentication with /users/me...');
    try {
        const response = await axios.get(`${apiBase}/wp/v2/users/me`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Authentication successful (${response.status})`);
        console.log(`User ID: ${response.data.id}`);
        console.log(`Username: ${response.data.username}`);
        console.log(`Display Name: ${response.data.name}`);
        console.log(`Roles: ${response.data.roles?.join(', ') || 'none'}`);
    } catch (error) {
        console.log(`❌ Authentication failed: ${error.response?.status || error.message}`);
        if (error.response?.data) {
            console.log(`   Error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
            console.log(`   Code: ${error.response.data.code || 'unknown'}`);
        }
    }
    
    console.log('');
    
    // Test 4: Alternative auth methods
    console.log('4️⃣ Testing alternative endpoints...');
    
    // Test posts endpoint with auth
    try {
        const response = await axios.get(`${apiBase}/wp/v2/posts`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            params: {
                per_page: 1
            }
        });
        console.log(`✅ Posts endpoint with auth: ${response.status}`);
        console.log(`Posts available: ${response.headers['x-wp-total'] || 'unknown'}`);
    } catch (error) {
        console.log(`❌ Posts endpoint failed: ${error.response?.status || error.message}`);
    }
    
    // Test media endpoint with auth
    try {
        const response = await axios.get(`${apiBase}/wp/v2/media`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            params: {
                per_page: 1
            }
        });
        console.log(`✅ Media endpoint with auth: ${response.status}`);
        console.log(`Media items: ${response.headers['x-wp-total'] || 'unknown'}`);
    } catch (error) {
        console.log(`❌ Media endpoint failed: ${error.response?.status || error.message}`);
    }
    
    console.log('');
    
    // Test 5: Check WordPress version and capabilities
    console.log('5️⃣ Checking WordPress info...');
    try {
        const response = await axios.get(`${baseUrl}/wp-json`);
        if (response.data) {
            console.log(`WordPress Version: ${response.data.gmt_offset !== undefined ? 'Detected' : 'Unknown'}`);
            console.log(`Site Name: ${response.data.name || 'Unknown'}`);
            console.log(`Site Description: ${response.data.description || 'None'}`);
            console.log(`Site URL: ${response.data.url || 'Unknown'}`);
            
            if (response.data.authentication) {
                console.log('🔐 Authentication methods:');
                Object.keys(response.data.authentication).forEach(method => {
                    console.log(`   - ${method}`);
                });
            }
        }
    } catch (error) {
        console.log(`❌ WordPress info failed: ${error.message}`);
    }
    
    console.log('\n📋 Diagnosis Summary:');
    console.log('If authentication is failing but the API is accessible:');
    console.log('1. Check if Application Passwords are enabled in WordPress');
    console.log('2. Verify the username is correct (case-sensitive)');
    console.log('3. Ensure the application password was copied correctly');
    console.log('4. Check if the user has sufficient permissions');
    console.log('5. Some WordPress installations disable /users/me for security');
}

// Run the diagnostic
diagnoseWordPressAuth().catch(console.error);