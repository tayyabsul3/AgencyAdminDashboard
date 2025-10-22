# 🎨 HeyGen Video Customization Guide
## Background & Thumbnail Options

Based on the official HeyGen API documentation, here's everything you can do to customize video backgrounds and thumbnails.

---

## 📐 Background Customization Options

HeyGen API v2 supports **THREE** types of backgrounds:

### 1. **Color Background** 🎨
Solid color backgrounds using hex codes.

**Payload Structure:**
```javascript
background: {
  type: 'color',
  value: '#HEXCODE'  // e.g., '#FAFAFA', '#008000'
}
```

**Examples:**
- `#FAFAFA` - Light gray (professional)
- `#FFFFFF` - White
- `#000000` - Black
- `#667eea` - Purple gradient
- `#008000` - **Green screen** (for chroma key!)

**Use Cases:**
- Simple, professional videos
- Green screen for later compositing
- Brand color matching

---

### 2. **Image Background** 🖼️
Static images as backgrounds.

**Payload Structure:**
```javascript
background: {
  type: 'image',
  url: 'https://example.com/image.jpg'  // External image URL
}
```

**OR**

```javascript
background: {
  type: 'image',
  image_asset_id: '<asset_id>'  // HeyGen-hosted image
}
```

**Supported Formats:**
- JPG
- PNG
- Publicly accessible URLs

**Use Cases:**
- Branded backgrounds with logos
- Office/studio environments
- Custom scenic backgrounds
- Product showcase backgrounds

**Important Notes:**
- ✅ Must be publicly accessible URL
- ✅ Or upload to HeyGen first and use `image_asset_id`
- ❌ Google Drive links need public access
- ❌ Authentication-required URLs won't work

---

### 3. **Video Background** 🎥 **(DRAMATIC!)**
Animated/video backgrounds for more dynamic content.

**Payload Structure:**
```javascript
background: {
  type: 'video',
  url: 'https://example.com/video.mp4',  // External video URL
  play_style: 'loop'  // How video plays
}
```

**OR**

```javascript
background: {
  type: 'video',
  video_asset_id: '<asset_id>',
  play_style: 'loop'
}
```

**Play Style Options:**
- `loop` - Video loops continuously (most dramatic!)
- `fit_to_scene` - Fits to scene duration
- `freeze` - Freezes at a frame
- `once` - Plays once then stops

**Use Cases:**
- **Motion graphics** behind avatar
- **Animated backgrounds** (particles, waves, etc.)
- **City skylines** with moving elements
- **Abstract patterns** for modern look
- **Nature scenes** (clouds, water, etc.)

**THIS IS HOW YOU MAKE THUMBNAILS DRAMATIC!**
- Use dynamic video backgrounds
- Add motion and energy to the video
- The thumbnail HeyGen generates will capture a frame from the video

---

## 🖼️ Thumbnail Customization

### **Important: HeyGen Auto-Generates Thumbnails**

According to the API documentation:

✅ **HeyGen automatically generates:**
- `thumbnail_url` - Static image thumbnail
- `gif_url` - Animated GIF preview
- `video_url` - Full video

❌ **You CANNOT:**
- Manually set a custom thumbnail during generation
- Upload your own thumbnail image
- Specify which frame to use as thumbnail

### **How to Get "Dramatic" Thumbnails:**

Since HeyGen auto-generates thumbnails, here's how to influence them:

#### **Option 1: Use Video Backgrounds** ⭐ BEST
```javascript
background: {
  type: 'video',
  url: 'https://dramatic-motion-graphics.mp4',
  play_style: 'loop'
}
```
- HeyGen captures a frame from the video
- Motion backgrounds = more engaging thumbnails
- Choose videos with bold colors and movement

#### **Option 2: Use Striking Image Backgrounds**
```javascript
background: {
  type: 'image',
  url: 'https://bold-colorful-background.jpg'
}
```
- Use high-contrast images
- Bright colors
- Geometric patterns
- Gradient designs

#### **Option 3: Use Bold Colors**
```javascript
background: {
  type: 'color',
  value: '#FF0000'  // Bold red
}
```
- High-contrast colors
- Complementary color schemes
- Avoid plain white/gray

---

## 🎯 Recommendations for Your Use Case

### **For Professional FAQ Videos:**

**Option A: Clean Professional**
```javascript
{
  background: {
    type: 'color',
    value: '#FAFAFA'  // Light gray
  }
}
```

**Option B: Branded Image**
```javascript
{
  background: {
    type: 'image',
    url: 'https://yourdomain.com/backgrounds/office-blur.jpg'
  }
}
```

**Option C: Dynamic & Engaging** ⭐
```javascript
{
  background: {
    type: 'video',
    url: 'https://yourdomain.com/backgrounds/subtle-particles.mp4',
    play_style: 'loop'
  }
}
```

---

## 📊 Current Implementation Status

### **What We Already Support:**
✅ Color backgrounds (currently hardcoded to `#FAFAFA`)
✅ Background type switching
✅ Background value customization

### **What We Need to Add:**
❌ Image background support
❌ Video background support
❌ `play_style` option for videos
❌ UI controls for background selection
❌ Background preview
❌ Pre-made background library

---

## 🛠️ Implementation Plan

### **Backend Changes Needed:**
1. Update payload to support:
   ```javascript
   background: {
     type: options.backgroundType || 'color',
     value: options.backgroundValue || '#FAFAFA',
     url: options.backgroundUrl || null,
     image_asset_id: options.backgroundImageId || null,
     video_asset_id: options.backgroundVideoId || null,
     play_style: options.backgroundPlayStyle || 'loop'
   }
   ```

2. Clean up payload (remove null fields):
   ```javascript
   // Remove url/asset_id if type is 'color'
   // Remove value if type is 'image' or 'video'
   ```

### **Frontend Changes Needed:**

1. **Add Background Type Selector:**
   ```javascript
   const [backgroundType, setBackgroundType] = useState('color');
   // Options: 'color', 'image', 'video'
   ```

2. **Add Background Inputs Based on Type:**
   - **Color:** Color picker
   - **Image:** URL input + optional upload
   - **Video:** URL input + play style selector

3. **Pre-made Background Library:**
   ```javascript
   const PRESET_BACKGROUNDS = {
     colors: [
       { name: 'Professional Gray', value: '#FAFAFA' },
       { name: 'Pure White', value: '#FFFFFF' },
       { name: 'Green Screen', value: '#008000' },
       { name: 'Deep Blue', value: '#0066CC' }
     ],
     images: [
       { name: 'Office Blur', url: 'https://...' },
       { name: 'Modern Studio', url: 'https://...' }
     ],
     videos: [
       { name: 'Subtle Particles', url: 'https://...' },
       { name: 'Abstract Waves', url: 'https://...' }
     ]
   };
   ```

4. **UI Layout:**
   ```
   [ Background Type: Color ▼ ]
   
   --- If Color ---
   [ Color: #FAFAFA  🎨 ]
   
   --- If Image ---
   [ Image URL: https://... ]
   [ Browse Presets ▼ ]
   
   --- If Video ---
   [ Video URL: https://... ]
   [ Play Style: Loop ▼ ]
   [ Browse Presets ▼ ]
   ```

---

## 🎬 Making Thumbnails More Dramatic

### **Strategy 1: Use Motion Backgrounds**
Upload or host dramatic video backgrounds:
- Abstract motion graphics
- Particle effects
- Animated gradients
- City skylines with movement
- Tech/digital themes

### **Strategy 2: Choose Dynamic Frames**
HeyGen picks the thumbnail frame automatically, so:
- Use videos with consistent visual interest
- Avoid static or slow-moving backgrounds
- Prefer high-contrast, colorful videos

### **Strategy 3: Post-Processing (Advanced)**
If you need custom thumbnails:
1. Generate video with HeyGen
2. Download the video
3. Extract a custom frame using ffmpeg
4. Upload as custom thumbnail to your platform

**Example (ffmpeg):**
```bash
# Extract frame at 2 seconds
ffmpeg -i video.mp4 -ss 00:00:02 -vframes 1 thumbnail.jpg

# Extract best quality frame
ffmpeg -i video.mp4 -vf "select=gt(scene\,0.4)" -frames:v 1 thumbnail.jpg
```

---

## 📦 Recommended Background Resources

### **Free Video Background Sources:**
- **Pexels Videos** - https://www.pexels.com/videos/
- **Pixabay Videos** - https://pixabay.com/videos/
- **Coverr** - https://coverr.co/
- **Videvo** - https://www.videvo.net/

### **Search Terms for Dramatic Backgrounds:**
- "abstract motion background"
- "particle effects loop"
- "animated gradient"
- "tech background animation"
- "corporate motion graphics"
- "digital wave animation"

### **Image Background Sources:**
- **Unsplash** - https://unsplash.com/
- **Pexels** - https://www.pexels.com/

---

## 🎯 Summary

### **Backgrounds:**
✅ **3 types:** Color, Image, Video
✅ **Video backgrounds** = Most dramatic!
✅ **Play styles:** loop, fit_to_scene, freeze, once
✅ **Green screen** supported (#008000)

### **Thumbnails:**
❌ **Cannot customize directly**
✅ **Auto-generated by HeyGen**
✅ **Influenced by background choice**
✅ **Video backgrounds = dynamic thumbnails**
✅ **Can post-process if needed**

### **Next Steps:**
1. Add background type selector to UI
2. Add URL inputs for image/video backgrounds
3. Create preset background library
4. Test with different background types
5. Optional: Add post-processing for custom thumbnails

---

**Would you like me to implement the background customization UI next?** 🚀
