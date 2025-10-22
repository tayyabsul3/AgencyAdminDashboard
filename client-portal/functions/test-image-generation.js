/**
 * Test script for Gemini Nano Banana Image Generation
 * 
 * Run this to test the image generation locally before deploying
 * Usage: node test-image-generation.js
 */

require('dotenv').config();
const { generateImageWithGemini, uploadToStorage } = require('./api/gemini-image-generator');
const { initializeFirebaseAdmin } = require('./lib/firebase-admin');

async function testImageGeneration() {
  console.log('🧪 Testing Gemini Nano Banana Image Generation\n');
  
  // Initialize Firebase Admin
  console.log('1️⃣ Initializing Firebase Admin...');
  try {
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin initialized\n');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
  
  // Test 1: Generate a simple image
  console.log('2️⃣ Generating test image...');
  const testPrompt = 'Professional image of a modern tech workspace with computers and coffee';
  
  try {
    const result = await generateImageWithGemini(testPrompt, {
      aspectRatio: '16:9'
    });
    
    if (result.success && result.imageData) {
      console.log('✅ Image generated successfully');
      console.log('   - Image data size:', result.imageData.length, 'bytes (base64)');
      console.log('   - MIME type:', result.mimeType);
      console.log('');
      
      // Test 2: Upload to Firebase Storage
      console.log('3️⃣ Uploading to Firebase Storage...');
      const publicUrl = await uploadToStorage(result.imageData, 'test-image');
      
      console.log('✅ Upload successful!');
      console.log('   - Public URL:', publicUrl);
      console.log('');
      
      console.log('🎉 All tests passed!\n');
      console.log('Next steps:');
      console.log('1. Deploy: firebase deploy --only functions');
      console.log('2. Test in UI: Open article editor and click "Generate Image"');
      
    } else {
      console.error('❌ Image generation failed');
      console.error('   - Result:', result);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   - Stack:', error.stack);
    process.exit(1);
  }
}

// Check environment variables
console.log('🔍 Checking environment configuration...\n');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in functions/.env');
  console.error('   Please add: GEMINI_API_KEY=your-api-key-here');
  process.exit(1);
}

console.log('✅ GEMINI_API_KEY is configured');
console.log('✅ Environment ready\n');

// Run the test
testImageGeneration().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
