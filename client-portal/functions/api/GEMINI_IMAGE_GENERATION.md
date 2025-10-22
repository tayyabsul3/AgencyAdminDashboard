# Gemini Nano Banana Image Generation

This document describes the implementation of Google's Gemini 2.5 Flash Image (aka "Nano Banana") for AI image generation in QueryFuel.

## Overview

The new implementation replaces the previous Google Apps Script-based image generation with Gemini's native image generation capabilities, providing:

- **Direct AI Integration**: Uses Gemini 2.5 Flash Image model directly
- **High-Quality Images**: State-of-the-art image generation with SynthID watermarking
- **Firebase Storage**: Automatic upload and hosting of generated images
- **Flexible Configuration**: Support for different aspect ratios and customization

## Architecture

### Backend Components

1. **`gemini-image-generator.js`** - Main handler for image generation
   - Processes image generation requests
   - Integrates with Gemini API
   - Handles Firebase Storage uploads
   - Returns public URLs for generated images

2. **Dependencies**
   - `@google/genai` - Gemini AI SDK for image generation
   - `firebase-admin` - Firebase Storage integration
   - `api-utils` - Request validation and error handling

### API Endpoint

**POST** `/api/image`

#### Request Body

```json
{
  "title": "Create a professional image of a futuristic city",
  "prompt": "High-quality image of a futuristic city with flying cars", // Optional, alternative to title
  "description": "Modern architecture, neon lights, sunset", // Optional
  "aspectRatio": "16:9" // Optional: "1:1", "4:3", "16:9", "9:16", etc.
}
```

or wrapped in `imageData`:

```json
{
  "imageData": {
    "title": "Professional featured image for article",
    "description": "Modern design with clean aesthetics",
    "aspectRatio": "16:9"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "shareableLink": "https://storage.googleapis.com/...",
    "url": "https://storage.googleapis.com/...",
    "title": "Create a professional image of a futuristic city",
    "createdAt": "2024-10-20T03:18:00.000Z",
    "model": "gemini-2.5-flash-image",
    "aspectRatio": "16:9"
  }
}
```

## Setup Instructions

### 1. Install Dependencies

Navigate to the functions directory and install the required package:

```bash
cd functions
npm install @google/genai@^0.9.0
```

### 2. Environment Variables

Ensure the following environment variables are set in `functions/.env`:

```env
# Gemini API Key (required)
GEMINI_API_KEY=your-gemini-api-key-here

# Firebase configuration (should already be set)
GOOGLE_APPLICATION_CREDENTIALS=./api/new-service-account-key.json
```

### 3. Firebase Storage Setup

Ensure Firebase Storage is enabled in your Firebase project:

1. Go to Firebase Console → Storage
2. Enable Cloud Storage if not already enabled
3. Verify storage bucket exists (should be automatic)

### 4. Deploy

Deploy the updated functions:

```bash
firebase deploy --only functions
```

Or for local testing:

```bash
firebase emulators:start
```

## Features

### Supported Aspect Ratios

- `1:1` - Square (1024x1024)
- `4:3` - Standard (1024x768)
- `16:9` - Widescreen (1024x576) - **Default**
- `9:16` - Portrait (576x1024)
- `3:2` - Photo (1024x682)
- `2:3` - Portrait Photo (682x1024)

### Automatic Features

- **Prompt Enhancement**: Automatically adds professional styling hints
- **SynthID Watermarking**: All generated images include invisible AI watermark
- **Firebase Storage**: Automatic upload with public URLs
- **Error Handling**: Comprehensive error messages and retry support

## Usage Example

### From Frontend (JavaScript)

```javascript
const generateImage = async (title) => {
  const response = await fetch(`${API_BASE_URL}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      title: title,
      aspectRatio: '16:9',
    }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Image URL:', result.data.url);
    return result.data.url;
  } else {
    console.error('Error:', result.error);
    throw new Error(result.error.message);
  }
};
```

### Direct API Call (cURL)

```bash
curl -X POST https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api/image \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Professional image of a modern workspace",
    "aspectRatio": "16:9"
  }'
```

## Migration from Google Apps Script

The new implementation maintains backward compatibility with the previous API:

- ✅ Same endpoint: `/api/image`
- ✅ Same request structure (supports both `title` and `imageData`)
- ✅ Same response format (includes `shareableLink` and `url`)
- ✅ No frontend changes required

### What Changed

| Aspect | Old (Apps Script) | New (Gemini Nano Banana) |
|--------|-------------------|--------------------------|
| Image Generation | Google Slides API | Gemini 2.5 Flash Image |
| Storage | Google Drive | Firebase Storage |
| Quality | Template-based | AI-generated, state-of-the-art |
| Speed | ~10-15 seconds | ~5-8 seconds |
| Aspect Ratios | Limited | Multiple options |
| Configuration | External Apps Script | Native to functions |

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY is not configured"**
   - Ensure `GEMINI_API_KEY` is set in `functions/.env`
   - Redeploy functions after updating environment variables

2. **"Storage upload failed"**
   - Verify Firebase Storage is enabled
   - Check service account permissions
   - Ensure storage bucket exists

3. **"No image data returned from Gemini"**
   - Check API key validity
   - Verify prompt is not empty
   - Check Gemini API quotas/limits

### Logs

View function logs:

```bash
firebase functions:log
```

Or in Firebase Console → Functions → Logs

## Performance

- **Average Generation Time**: 5-8 seconds
- **Image Size**: ~200-500 KB (PNG format)
- **Timeout**: 540 seconds (configured in functions)
- **Memory**: 2GiB (configured in functions)

## Security

- **API Key**: Stored securely in environment variables
- **Authentication**: Supports Firebase Auth token validation
- **Storage**: Public URLs for easy sharing
- **Rate Limiting**: Inherits Firebase Functions limits

## Limitations

- Maximum image generation: Subject to Gemini API quotas
- Image format: PNG only (best quality)
- Storage: Uses default Firebase Storage bucket
- Concurrent requests: Limited by Firebase Functions concurrency

## Resources

- [Gemini Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Firebase Storage Docs](https://firebase.google.com/docs/storage)
- [@google/genai SDK](https://www.npmjs.com/package/@google/genai)

## Support

For issues or questions:
1. Check Firebase Functions logs
2. Verify environment configuration
3. Review error messages in response
4. Contact support@queryfuel.io
