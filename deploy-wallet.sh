#!/bin/bash

echo "🚀 Deploying Botomics Wallet to Yegara.com..."

# 1. Check if wallet folder exists
if [ ! -d "wallet" ]; then
    echo "❌ Wallet folder not found!"
    exit 1
fi

echo "📁 Wallet folder found at: $(pwd)/wallet"

# 2. Update wallet/app.js with correct backend URL
echo "🔄 Updating wallet/app.js for deployment..."
if [ -f "wallet/app.js" ]; then
    # Backup original
    cp wallet/app.js wallet/app.js.backup
    
    # Replace backend URL
    sed -i "s|const BACKEND_URL = 'https://testweb.maroset.com/api'|const BACKEND_URL = '/api'|g" wallet/app.js
    sed -i "s|const BACKEND_URL = '/api'|const BACKEND_URL = '/api'|g" wallet/app.js  # Ensure it's set
    
    echo "✅ Updated wallet/app.js backend URL"
else
    echo "❌ wallet/app.js not found!"
    exit 1
fi

# 3. Create testweb.maroset.com directory structure on Yegara.com
echo "📂 Creating deployment structure..."
mkdir -p testweb_deployment
mkdir -p testweb_deployment/wallet

# 4. Copy wallet files
cp wallet/index.html testweb_deployment/wallet/
cp wallet/app.js testweb_deployment/wallet/
cp wallet/style.css testweb_deployment/wallet/
cp wallet/manifest.json testweb_deployment/wallet/

# 5. Copy src/app.js (updated version)
cp src/app.js testweb_deployment/src_app.js.backup

# 6. Create deployment info file
cat > testweb_deployment/DEPLOYMENT_INFO.md << 'EOF'
# Botomics Wallet Deployment

## Files to deploy:

### 1. Wallet Mini App (Static Files)
- `wallet/index.html` → https://testweb.maroset.com/wallet/index.html
- `wallet/app.js` → https://testweb.maroset.com/wallet/app.js  
- `wallet/style.css` → https://testweb.maroset.com/wallet/style.css
- `wallet/manifest.json` → https://testweb.maroset.com/wallet/manifest.json

### 2. Main Application
- `src/app.js` → Replace existing file with updated version

### 3. Database
Tables already created:
- wallets
- wallet_transactions  
- withdrawals

## Deployment Steps:

1. **Upload wallet files** to Yegara.com:
   - cPanel → File Manager → public_html/testweb.maroset.com/wallet/
   - Upload all files from wallet/ folder

2. **Update main application:**
   - Replace src/app.js with updated version
   - Restart application (PM2 restart)

3. **Test deployment:**
   - https://testweb.maroset.com/wallet
   - https://testweb.maroset.com/api/wallet/health
   - Open @BotomicsBot and use /wallet command

## API Endpoints:
- GET /api/wallet/balance?userId=123
- GET /api/wallet/transactions?userId=123
- POST /api/wallet/deposit
- POST /api/wallet/withdraw
- POST /api/wallet/transfer
- GET /api/subscription/status?userId=123
- POST /api/subscription/upgrade
- POST /api/subscription/cancel
EOF

echo "✅ Deployment package created in: testweb_deployment/"
echo ""
echo "📤 To deploy to Yegara.com:"
echo ""
echo "OPTION 1: Manual Upload via cPanel"
echo "   1. Login to https://yegara.com:2083"
echo "   2. Go to File Manager"
echo "   3. Navigate to: public_html/testweb.maroset.com/"
echo "   4. Upload wallet/ folder"
echo "   5. Replace src/app.js with updated version"
echo ""
echo "OPTION 2: Git Push (if connected)"
echo "   1. Add wallet/ folder to git:"
echo "      git add wallet/"
echo "      git add src/app.js"
echo "   2. Commit: git commit -m 'Deploy Botomics Wallet'"
echo "   3. Push: git push origin main"
echo "   4. Deploy on Yegara.com cPanel Git Version Control"
echo ""
echo "🧪 After deployment, test:"
echo "   - https://testweb.maroset.com/wallet"
echo "   - Open @BotomicsBot and type /wallet"