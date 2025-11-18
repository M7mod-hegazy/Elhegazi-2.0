# 🚀 Deployment Guide

This guide covers deploying **Elhegazi 2.0** to Railway.app (recommended) or other platforms.

## 📋 Prerequisites

- GitHub account with repository access
- Railway.app account (free tier)
- Environment variables ready

## 🚂 Railway.app Deployment (Recommended)

Railway is the **best choice** for this full-stack monorepo because:
- ✅ Supports Node.js backend + React frontend
- ✅ Free tier: $5/month credit (covers small projects)
- ✅ No cold starts
- ✅ Easy environment variable management
- ✅ Auto-deploys on git push

### Step 1: Prepare Repository

```bash
# Ensure .env files are in .gitignore (they should be)
git status
# Should NOT show server/.env or .env.local

# Commit all changes
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### Step 2: Sign Up on Railway

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign up with GitHub
4. Authorize Railway to access your repositories

### Step 3: Create Railway Project

1. Click "New Project"
2. Select "Deploy from GitHub"
3. Choose your repository: `M7mod-hegazy/Elhegazi-2.0`
4. Railway auto-detects Node.js
5. Click "Deploy"

### Step 4: Add Environment Variables

In Railway Dashboard:

1. Go to your project
2. Click "Variables" tab
3. Add all variables from `server/.env.example`:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=appdb
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=4000
NODE_ENV=production
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
FRONTEND_URL=https://your-railway-domain.railway.app
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password
```

### Step 5: Configure Build & Deploy

1. Click "Settings" tab
2. Set build command: `npm install && npm run build`
3. Set start command: `npm run server`
4. Save

### Step 6: Deploy

Railway auto-deploys after git push. To manually trigger:

1. Go to "Deployments" tab
2. Click "Deploy" button
3. Monitor logs in real-time

### Step 7: Get Public URL

1. Go to "Settings"
2. Find "Public URL"
3. Copy the URL: `https://your-app.railway.app`
4. Update `FRONTEND_URL` in environment variables

## 🔗 MongoDB Atlas Setup

### Free Tier

1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Sign up (free)
3. Create a cluster (free tier)
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/`
5. Add Railway IP to Network Access:
   - Go to "Network Access"
   - Click "Add IP Address"
   - Enter `0.0.0.0/0` (allows all IPs)
   - Confirm

## 🖼️ Cloudinary Setup

### Free Tier

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up (free)
3. Go to Dashboard
4. Copy credentials:
   - Cloud Name
   - API Key
   - API Secret
5. Add to Railway environment variables

## 📧 Gmail Setup

### App Password (Required)

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Enable 2-factor authentication
3. Go to "App passwords"
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password
6. Use this as `EMAIL_PASSWORD` in Railway

## ✅ Post-Deployment Checklist

- [ ] Environment variables set in Railway
- [ ] MongoDB connection working
- [ ] Cloudinary uploads working
- [ ] Email sending working
- [ ] Frontend loads at public URL
- [ ] API responds at `/api/debug/whoami`
- [ ] 3D shop builder works
- [ ] Products can be created
- [ ] Orders can be placed

## 🐛 Troubleshooting

### Build Fails

```bash
# Check logs in Railway dashboard
# Common issues:
# - Missing environment variables
# - Node version mismatch
# - Dependency conflicts

# Solution: Check package.json Node version requirement
```

### MongoDB Connection Error

```
Error: connect ECONNREFUSED
```

**Solution:**
1. Verify MongoDB URI in Railway variables
2. Check IP whitelist in MongoDB Atlas (add 0.0.0.0/0)
3. Ensure credentials are correct

### Frontend Can't Reach Backend

```
Error: Failed to fetch /api/...
```

**Solution:**
1. Check `FRONTEND_URL` in backend environment
2. Verify CORS is enabled in Express
3. Check backend is running: `https://your-app.railway.app/api/debug/whoami`

### Email Not Sending

```
Error: Invalid login: 535-5.7.8 Username and password not accepted
```

**Solution:**
1. Use Gmail App Password (not regular password)
2. Enable 2-factor authentication on Gmail
3. Verify EMAIL_USER is correct

## 📊 Monitoring

### View Logs

1. Go to Railway Dashboard
2. Click "Logs" tab
3. Filter by service (backend/frontend)
4. Search for errors

### Monitor Performance

1. Go to "Metrics" tab
2. Check CPU, Memory, Network usage
3. Typical usage: <100MB memory, <5% CPU

## 💰 Cost Management

### Free Tier ($5/month credit)

- Backend: ~$2-3/month
- Frontend: ~$0.50/month
- Database: ~$1/month
- **Total: ~$3.50/month** ✅

### After Free Credit

- Pay-as-you-go: $0.00463/hour for compute
- ~$3-5/month for small app

### Cost Optimization

1. Use Railway's free tier
2. Use MongoDB Atlas free tier
3. Use Cloudinary free tier
4. Minimize API calls
5. Enable caching

## 🔄 Continuous Deployment

Railway auto-deploys on git push:

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Railway automatically:
# 1. Detects changes
# 2. Builds the app
# 3. Runs tests (if configured)
# 4. Deploys to production
# 5. Updates live URL
```

## 🆘 Need Help?

1. Check Railway docs: [docs.railway.app](https://docs.railway.app)
2. Check MongoDB docs: [docs.mongodb.com](https://docs.mongodb.com)
3. Check Express docs: [expressjs.com](https://expressjs.com)
4. Create GitHub issue with error details

---

**Happy deploying! 🚀**
