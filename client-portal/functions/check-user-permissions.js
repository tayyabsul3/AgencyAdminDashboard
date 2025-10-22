#!/usr/bin/env node

/**
 * WordPress User Permissions Checker
 * Tests what the current user can do
 */

const axios = require('axios');

const WORDPRESS_CONFIG = {
    siteUrl: 'https://xovotech.shop/project',
    username: 'xovotech_z3r4dn',
    applicationPassword: 'Dev@project123@@@'
};

async function checkUserPermissions() {
    console.log('🔍 WordPress User Permissions Check\n');
    
    const baseUrl = WORDPRESS_CONFIG.siteUrl;
    const apiBase = `${baseUrl}/wp-json/wp/v2`;
    
    // Create auth header
    const auth = Buffer.from(`${WORDPRESS_CONFIG.username}:${WORDPRESS_CONFIG.applicationPassword}`).toString('base64');
    const authHeader = `Basic ${auth}`;
    
    console.log('📋 Testing user capabilities...\n');
    
    // Test 1: Check what posts the user can see
    console.log('1️⃣ Testing posts access...');
    try {
        const response = await axios.get(`${apiBase}/posts`, {
            headers: { 'Authorization': authHeader },
            params: { per_page: 5 }
        });
        console.log(`✅ Can read posts: ${response.data.length} posts found`);
        console.log(`Total posts: ${response.headers['x-wp-total'] || 'unknown'}`);
    } catch (error) {
        console.log(`❌ Cannot read posts: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('');
    
    // Test 2: Check media access
    console.log('2️⃣ Testing media access...');
    try {
        const response = await axios.get(`${apiBase}/media`, {
            headers: { 'Authorization': authHeader },
            params: { per_page: 5 }
        });
        console.log(`✅ Can read media: ${response.data.length} media items found`);
        console.log(`Total media: ${response.headers['x-wp-total'] || 'unknown'}`);
    } catch (error) {
        console.log(`❌ Cannot read media: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('');
    
    // Test 3: Check users access
    console.log('3️⃣ Testing users access...');
    try {
        const response = await axios.get(`${apiBase}/users`, {
            headers: { 'Authorization': authHeader },
            params: { per_page: 5 }
        });
        console.log(`✅ Can read users: ${response.data.length} users found`);
        response.data.forEach(user => {
            console.log(`   - ${user.name} (${user.username}) - Roles: ${user.roles?.join(', ') || 'none'}`);
        });
    } catch (error) {
        console.log(`❌ Cannot read users: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('');
    
    // Test 4: Try to create a simple post (draft)
    console.log('4️⃣ Testing post creation...');
    try {
        const response = await axios.post(`${apiBase}/posts`, {
            title: 'Test Post - Permission Check',
            content: 'This is a test post to check permissions.',
            status: 'draft'
        }, {
            headers: { 
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Can create posts: Created post ID ${response.data.id}`);
        
        // Clean up - delete the test post
        try {
            await axios.delete(`${apiBase}/posts/${response.data.id}`, {
                headers: { 'Authorization': authHeader }
            });
            console.log(`   🗑️  Cleaned up test post`);
        } catch (deleteError) {
            console.log(`   ⚠️  Could not delete test post: ${deleteError.response?.data?.message || deleteError.message}`);
        }
    } catch (error) {
        console.log(`❌ Cannot create posts: ${error.response?.data?.message || error.message}`);
        if (error.response?.data?.code) {
            console.log(`   Code: ${error.response.data.code}`);
        }
    }
    
    console.log('');
    
    // Test 5: Check current user info (if available)
    console.log('5️⃣ Getting current user info...');
    try {
        const response = await axios.get(`${apiBase}/users/me`, {
            headers: { 'Authorization': authHeader }
        });
        console.log(`✅ Current user info:`);
        console.log(`   ID: ${response.data.id}`);
        console.log(`   Username: ${response.data.username}`);
        console.log(`   Display Name: ${response.data.name}`);
        console.log(`   Email: ${response.data.email}`);
        console.log(`   Roles: ${response.data.roles?.join(', ') || 'none'}`);
        console.log(`   Capabilities: ${response.data.capabilities ? Object.keys(response.data.capabilities).length : 'unknown'} capabilities`);
        
        if (response.data.capabilities) {
            const importantCaps = ['upload_files', 'edit_posts', 'publish_posts', 'delete_posts'];
            console.log(`   Key capabilities:`);
            importantCaps.forEach(cap => {
                const hasCapability = response.data.capabilities[cap];
                console.log(`     - ${cap}: ${hasCapability ? '✅' : '❌'}`);
            });
        }
    } catch (error) {
        console.log(`❌ Cannot get current user: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n📋 Summary:');
    console.log('If media upload is failing, the user likely needs:');
    console.log('1. "upload_files" capability');
    console.log('2. "Author" role or higher');
    console.log('3. Proper WordPress user permissions');
    console.log('\n💡 Solution: In WordPress admin, go to Users and ensure the user has appropriate role/permissions.');
}

// Run the check
checkUserPermissions().catch(console.error);