#!/bin/bash

echo "🚀 Deploying Botomics Wallet to Yegara.com..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if wallet folder exists
if [ ! -d "wallet" ]; then
    echo -e "${RED}❌ Wallet folder not found!${NC}"
    echo -e "${YELLOW}Expected: $(pwd)/wallet${NC}"
    exit 1
fi

echo -e "${GREEN}📁 Wallet folder found at: $(pwd)/wallet${NC}"

# Check required files
REQUIRED_FILES=("index.html" "app.js" "style.css" "manifest.json")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "wallet/$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required wallet files:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo -e "  - $file"
    done
    exit 1
fi

echo -e "${GREEN}✅ All required wallet files found${NC}"

# Create deployment package
echo -e "${BLUE}📦 Creating deployment package...${NC}"
DEPLOY_DIR="botomics_wallet_deploy_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEPLOY_DIR/wallet"

# Copy wallet files
cp wallet/index.html "$DEPLOY_DIR/wallet/"
cp wallet/app.js "$DEPLOY_DIR/wallet/"
cp wallet/style.css "$DEPLOY_DIR/wallet/"
cp wallet/manifest.json "$DEPLOY_DIR/wallet/"

# Copy .htaccess if exists
if [ -f ".htaccess" ]; then
    cp .htaccess "$DEPLOY_DIR/"
    echo -e "${GREEN}✅ Included .htaccess configuration${NC}"
fi

# Create deployment instructions
cat > "$DEPLOY_DIR/DEPLOYMENT_INSTRUCTIONS.md" << 'EOF'
# Botomics Wallet Deployment Instructions

## Deployment Target
- **URL:** https://testweb.maroset.com/wallet/
- **Path:** /home/maroseff/public_html/testweb.maroset.com/

## Files to Deploy
1. Copy all files from `wallet/` folder to: