# Yegara.com (cPanel) Deployment Guide

## Prerequisites
- Yegara.com cPanel account with SSH access
- Node.js support (usually available)
- PostgreSQL database
- Environment variables configured

## Step-by-Step Deployment

### 1. Prepare Your Repository
- Ensure all files are committed to GitHub
- Verify `.cpanel.yml` is in root directory
- Check `package.json` has correct scripts

### 2. cPanel Setup
1. Login to Yegara.com cPanel
2. Go to **Git Version Control** under **Files**
3. Click **CREATE**

### 3. Repository Configuration
- **Clone URL**: `https://github.com/yourusername/your-repo.git`
- **Repository Path**: `/home/username/repositories/your-repo`
- **Repository Name**: `botomics-bot`

### 4. Environment Variables
1. Go to cPanel → **Environment Variables**
2. Add these variables:
   - `BOT_TOKEN=7983296108:AAH8Dj_5WfhPN7g18jFI2VsexzJAiCjPgpI`
   - `ENCRYPTION_KEY=W370NNal3+hm8KmDwQVOd2tzhW8S5Ma+Fk8MvVMK5QU=`
   - `DATABASE_URL=your_postgresql_connection_string`
   - `NODE_ENV=production`
   - `PORT=3000`

### 5. Database Setup
1. Go to cPanel → **PostgreSQL Databases**
2. Create new database and user
3. Note the connection details for DATABASE_URL

### 6. Initial Deployment
1. In Git Version Control, click **MANAGE** on your repository
2. Click **UPDATE FROM REMOTE** (fetches latest code)
3. Click **DEPLOY HEAD COMMIT** (deploys to public_html)

### 7. Start Application
Via SSH:
```bash
cd ~/public_html
npm install
npm start