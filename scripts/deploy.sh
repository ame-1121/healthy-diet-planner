#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   🥗 AI 健康饮食规划 — 一键部署      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# 1. Build
echo "  📦 [1/3] npm run build …"
cd "$REPO_DIR"
npm run build --silent

# 2. Deploy gh-pages from a TEMP directory (not from working tree)
echo "  🚀 [2/3] Deploy to gh-pages …"
DEPLOY_DIR=$(mktemp -d)
REMOTE_URL=$(git remote get-url origin)

# Copy dist to temp dir
cp -r "$REPO_DIR/dist/"* "$DEPLOY_DIR/"
touch "$DEPLOY_DIR/.nojekyll"

# Init a new git repo in the temp dir
cd "$DEPLOY_DIR"
git init --quiet
git checkout -b gh-pages --quiet
git add .
git commit -m "🚀 Deploy — $TIMESTAMP" --quiet

# Push from temp dir (retry up to 10 times)
for i in $(seq 1 10); do
  if git push --force "$REMOTE_URL" gh-pages --quiet 2>/dev/null; then
    echo "  ✅ gh-pages pushed (attempt $i)"
    rm -rf "$DEPLOY_DIR"
    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║  ✅ 部署完成！$TIMESTAMP ║"
    echo "  ╠══════════════════════════════════════╣"
    echo "  ║  🔗  https://ame-1121.github.io      ║"
    echo "  ║       /healthy-diet-planner/         ║"
    echo "  ╚══════════════════════════════════════╝"
    echo ""
    exit 0
  fi
  sleep 5
done

# Clean up on failure
rm -rf "$DEPLOY_DIR"
echo "  ❌ Deploy failed after 10 attempts"
exit 1
