#!/bin/bash
# ============================================
# 教务办·智能体 一键发版脚本
# 用法: bash publish.sh 0.1.5
# ============================================
set -e

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "用法: bash publish.sh <版本号>"
  echo "示例: bash publish.sh 0.1.5"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "=========================================="
echo "  教务办·智能体 发版 v$VERSION"
echo "=========================================="

# 1. 更新版本号
echo "[1/7] 更新版本号..."
cd "$ROOT"
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
sed -i "s/VERSION = \".*\"/VERSION = \"$VERSION\"/" backend/app/main.py
echo "  OK: package.json + backend/app/main.py → $VERSION"

# 2. 提交版本号变更（先提交，确保 tag 指向正确 commit）
echo "[2/7] 提交版本号..."
git add frontend/package.json backend/app/main.py
git commit -m "chore: bump version to $VERSION" || echo "  (无新变更，跳过)"
echo "  OK"

# 3. 构建前端
echo "[3/7] 构建前端..."
cd "$ROOT/frontend"
npm run build --silent
echo "  OK"

# 4. 构建安装包（--publish never 不碰 GitHub，避免创建 Draft）
echo "[4/7] 构建安装包..."
export GH_TOKEN=$(gh auth token)
npx electron-builder --win --publish never
echo "  OK"

# 5. 推送到 GitHub + 打标签
echo "[5/7] 推送代码..."
cd "$ROOT"
git push origin combined-test
git tag -af "v$VERSION" -m "v$VERSION"
git push origin "v$VERSION" --force
echo "  OK: combined-test + v$VERSION"

# 6. 创建正式 Release 并上传文件
echo "[6/7] 发布到 GitHub..."
cd "$ROOT/前端"

# latest.yml 检查
if [ ! -f "latest.yml" ]; then
  echo "  错误: latest.yml 未找到"
  exit 1
fi

# 新命名规范：v{version}-jiaowuban-agent-setup.exe
NEW_EXE_NAME="v${VERSION}-jiaowuban-agent-setup.exe"
NEW_EXE_BLOCKMAP="${NEW_EXE_NAME}.blockmap"

# electron-builder 生成的文件名基于 productName（中文）
PRODUCT_EXE="教务办智能体 Setup ${VERSION}.exe"
cp "$PRODUCT_EXE" "$NEW_EXE_NAME"
cp "${PRODUCT_EXE}.blockmap" "$NEW_EXE_BLOCKMAP"
echo "  OK: $PRODUCT_EXE → $NEW_EXE_NAME"

# 同步更新 latest.yml 中的 path 和 url 字段
sed -i "s|^path:.*|path: ${NEW_EXE_NAME}|" latest.yml
sed -i "s|  - url:.*|  - url: ${NEW_EXE_NAME}|" latest.yml

# 删除可能存在的旧 Draft Release（electron-builder 残留）
gh release delete "v$VERSION" --yes 2>/dev/null || true
gh release delete "$VERSION" --yes 2>/dev/null || true

# 创建正式 Release（draft=false 是关键！）
gh release create "v$VERSION" \
  "$NEW_EXE_NAME" \
  "$NEW_EXE_BLOCKMAP" \
  "latest.yml" \
  --title "v$VERSION" \
  --notes "教务办·智能体 v$VERSION" \
  --draft=false

echo "  OK: $NEW_EXE_NAME + $NEW_EXE_BLOCKMAP + latest.yml"

# 7. 打包后端
echo "[7/7] 打包后端..."
cd "$ROOT"
rm -rf jiaowuban-backend
mkdir -p jiaowuban-backend
cp backend/Dockerfile jiaowuban-backend/
cp backend/docker-compose.yml jiaowuban-backend/
cp backend/requirements.txt jiaowuban-backend/
cp backend/update.sh jiaowuban-backend/
cp -r backend/app jiaowuban-backend/
find jiaowuban-backend -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null
find jiaowuban-backend -type f -name '*.pyc' -delete 2>/dev/null
echo "  OK: jiaowuban-backend/ 已打包"

echo ""
echo "=========================================="
echo "  v$VERSION 发版完成！"
echo "=========================================="