#!/bin/bash
# ═══════════════════════════════════════════════
# Traffic68 — VPS Deploy Script
# Chạy: bash deploy.sh
# ═══════════════════════════════════════════════

set -e

cd /www/wwwroot/traffic68.com

echo "═══════════════════════════════════════"
echo "  Traffic68 Deploy"
echo "═══════════════════════════════════════"

# 1. Pull code mới (giữ nguyên .env, node_modules, data)
echo ""
echo "📥 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

# 2. Install dependencies (chỉ cài thêm nếu có thay đổi)
echo ""
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# 3. Build frontend
echo ""
echo "🔨 Building frontend..."
npm run build

# 4. Restart server
echo ""
echo "🔄 Restarting server..."
pm2 restart traffic68

# 5. Verify
echo ""
echo "⏳ Waiting 3 seconds..."
sleep 3
pm2 logs traffic68 --lines 5 --nostream

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Deploy complete!"
echo "═══════════════════════════════════════"
