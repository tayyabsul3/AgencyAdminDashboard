# Dual Portal Deployment Guide

This project now contains both the Admin Portal and Client Portal in a single repository for unified deployment.

## Project Structure

```
/
├── src/                    # Admin Portal source code
├── client-portal/          # Client Portal source code (copied from queryfuel-kiro)
├── out/                    # Build output directory
│   ├── index.html         # Admin Portal entry point
│   └── client/            # Client Portal files
├── build-both.js          # Build script for both applications
└── firebase.json          # Firebase hosting configuration
```

## Development

### Running Admin Portal
```bash
npm run dev
# Runs on http://localhost:4000
```

### Running Client Portal
```bash
npm run dev:client
# Runs on http://localhost:3000
```

## Building for Production

### Build Both Applications
```bash
npm run build:both
```

This will:
1. Build the Admin Portal to `/out`
2. Build the Client Portal to `/client-portal/out`
3. Copy Client Portal build to `/out/client`

## Deployment

### Firebase Hosting
```bash
firebase deploy
```

The deployment will serve:
- Admin Portal at: `https://your-domain.com/`
- Client Portal at: `https://your-domain.com/client/`

### URL Structure
- **Admin Portal**: `/` (root)
- **Client Portal**: `/client/*`
- **API Functions**: `/api/*` (from client portal)

## Navigation Between Portals

### From Admin to Client
- Click the "Client Portal" button in the admin header
- Opens client portal in a new tab

### From Client to Admin
- Click the "Admin Portal" button (top-right corner)
- Opens admin portal in a new tab

## Firebase Configuration

The `firebase.json` is configured to:
- Serve admin portal from `/out`
- Serve client portal from `/out/client`
- Route API calls to Firebase Functions
- Handle client-side routing for both apps

## Environment Variables

Make sure to copy environment variables from both projects:
- Admin Portal: `.env`, `.env.local`
- Client Portal: `client-portal/.env.local`

## Troubleshooting

### Build Issues
1. Ensure both projects have their dependencies installed
2. Check that Firebase Functions are properly configured
3. Verify environment variables are set correctly

### Routing Issues
1. Client portal routes are prefixed with `/client`
2. Admin portal handles root routes
3. API routes go to Firebase Functions

### Development Issues
1. Run each portal separately during development
2. Use different ports (Admin: 4000, Client: 3000)
3. Test navigation between portals before deployment