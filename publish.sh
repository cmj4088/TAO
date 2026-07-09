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

# 从 latest.yml 获取英文 exe 文件名（electron-builder 用 name 字段生成）
EXE_NAME=$(grep "^path:" latest.yml | head -1 | sed 's/path: //' | tr -d '[:space:]')
EXE_BLOCKMAP="${EXE_NAME}.blockmap"

# electron-builder 生成的文件名基于 productName（中文），复制为英文名
PRODUCT_EXE="教务办智能体 Setup ${VERSION}.exe"
if [ -f "$PRODUCT_EXE" ] && [ ! -f "$EXE_NAME" ]; then
  cp "$PRODUCT_EXE" "$EXE_NAME"
  echo "  OK: 复制 $PRODUCT_EXE → $EXE_NAME"
fi
if [ -f "${PRODUCT_EXE}.blockmap" ] && [ ! -f "$EXE_BLOCKMAP" ]; then
  cp "${PRODUCT_EXE}.blockmap" "$EXE_BLOCKMAP"
fi

# 删除可能存在的旧 Draft Release（electron-builder 残留）
gh release delete "v$VERSION" --yes 2>/dev/null || true
gh release delete "$VERSION" --yes 2>/dev/null || true

# 创建正式 Release（draft=false 是关键！）
gh release create "v$VERSION" \
  "$EXE_NAME" \
  "$EXE_BLOCKMAP" \
  "latest.yml" \
  --title "v$VERSION" \
  --notes "教务办·智能体 v$VERSION" \
  --draft=false

echo "  OK: $EXE_NAME + $EXE_BLOCKMAP + latest.yml"

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

# 验证
echo ""
ASSETS=$(gh release view "v$VERSION" --json assets -q '.assets[].name' 2>/dev/null)
echo "$ASSETS"
if echo "$ASSETS" | grep -q "latest.yml" && echo "$ASSETS" | grep -q ".exe"; then
  echo "  ✅ Release 文件完整"
else
  echo "  ⚠️ 警告: Release 文件不完整"
fi

echo ""
echo "=========================================="
echo "  v$VERSION 发版完成！"
echo "=========================================="