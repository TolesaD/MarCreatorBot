#!/bin/bash

LOCAL_PATH="/path/to/your/local/botomics"
BACKUP_DIR="$HOME/botomics-backup-$(date +%Y%m%d_%H%M%S)"

echo "🔄 Updating local Botomics files..."

# Backup
echo "📦 Backing up current files..."
cp -r "$LOCAL_PATH" "$BACKUP_DIR"

# Update wallet files
echo "💰 Updating wallet files..."
cat > "$LOCAL_PATH/wallet/index.html" << 'EOF'
[PASTE THE COMPLETE index.html CONTENT HERE]
EOF

cat > "$LOCAL_PATH/wallet/style.css" << 'EOF'
[PASTE THE COMPLETE style.css CONTENT HERE]
EOF

cat > "$LOCAL_PATH/wallet/app.js" << 'EOF'
[PASTE THE COMPLETE app.js CONTENT HERE]
EOF

# Update other files
echo "⚙️ Updating configuration files..."
cat > "$LOCAL_PATH/.htaccess" << 'EOF'
[PASTE THE .htaccess CONTENT HERE]
EOF

cat > "$LOCAL_PATH/package.json" << 'EOF'
[PASTE THE package.json CONTENT HERE]
EOF

# Create API directory
echo "🔧 Setting up API..."
mkdir -p "$LOCAL_PATH/api"
cat > "$LOCAL_PATH/api/index.php" << 'EOF'
[PASTE THE index.php CONTENT HERE]
EOF

echo "✅ Local files updated successfully!"
echo "📁 Backup saved to: $BACKUP_DIR"