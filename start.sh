# 2. FORCE RAILWAY TO RUN YOUR CODE
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "nixpacks" },
  "deploy": { "startCommand": "node src/app.js" }
}
EOF