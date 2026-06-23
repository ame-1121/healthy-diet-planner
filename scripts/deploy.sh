#!/usr/bin/env bash
set -euo pipefail

# ============================================
#  🥗 AI 健康饮食规划 — 一键部署到 GitHub Pages
#  使用方法: npm run deploy
# ============================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH=$(git -C "$REPO_DIR" branch --show-current)
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   🥗 AI 健康饮食规划 — 一键部署      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ── 1. 构建 ──────────────────────────────────
echo "  📦 [1/4] npm run build …"
cd "$REPO_DIR"
npm run build --silent

# ── 2. 清理旧部署文件 ────────────────────────
echo "  🧹 [2/4] 准备部署文件 …"
DEPLOY_DIR=$(mktemp -d)
cp -r "$REPO_DIR/dist/"* "$DEPLOY_DIR/"
touch "$DEPLOY_DIR/.nojekyll"

# ── 3. 推送到 gh-pages ──────────────────────
echo "  🚀 [3/4] 推送到 GitHub Pages …"
cd "$REPO_DIR"
git checkout --orphan _gh-pages-deploy 2>/dev/null || true
git rm -rf --cached . 2>/dev/null || true
rm -rf assets dist src scripts index.html package.json *.ts 2>/dev/null || true
cp -r "$DEPLOY_DIR"/* .
cp "$DEPLOY_DIR"/.nojekyll . 2>/dev/null || true
git add .
git commit -m "🚀 Deploy — $TIMESTAMP" --quiet
git push origin _gh-pages-deploy:gh-pages --force --quiet

# ── 4. 切回原分支，清理临时文件 ──────────────
echo "  🔄 [4/4] 切回 $BRANCH 分支 …"
git checkout "$BRANCH" --quiet
git branch -D _gh-pages-deploy --quiet 2>/dev/null
rm -rf "$DEPLOY_DIR"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║  ✅ 部署完成！$TIMESTAMP ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║                                      ║"
echo "  ║  🔗 网址:                            ║"
echo "  ║  https://ame-1121.github.io          ║"
echo "  ║       /healthy-diet-planner/         ║"
echo "  ║                                      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
