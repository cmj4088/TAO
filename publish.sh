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

echo "=========================================="
echo "  教务办·智能体 发版 v$VERSION"
echo "=========================================="

# 1. 更新版本号
echo "[1/6] 更新版本号..."
cd "$(dirname "$0")"
# 更新 package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
# 更新后端 main.py
sed -i "s/VERSION = \".*\"/VERSION = \"$VERSION\"/" backend/app/main.py
echo "  OK: package.json + backend/app/main.py → $VERSION"

# 2. 构建前端
echo "[2/6] 构建前端..."
cd frontend
npm run build --silent
echo "  OK"

# 3. 发布到 GitHub（自动创建 Release + 上传 latest.yml）
echo "[3/6] 发布到 GitHub..."
export GH_TOKEN=$(gh auth token)
npx electron-builder --win --publish always 2>&1 | tail -3
echo "  OK"

# 4. 打包后端
echo "[4/6] 打包后端..."
cd ..
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

# 5. 提交 + 打标签
echo "[5/6] 提交代码..."
git add frontend/package.json backend/app/main.py
git commit -m "chore: bump version to $VERSION"
git tag -a "v$VERSION" -m "v$VERSION"
git push origin combined-test --tags
echo "  OK: 已推送 combined-test + v$VERSION"

# 6. 验证
echo "[6/6] 验证..."
RELEASE_URL=$(gh release view "v$VERSION" --json url -q '.url' 2>/dev/null || echo "")
if [ -n "$RELEASE_URL" ]; then
  echo "  OK: $RELEASE_URL"
else
  echo "  请检查: https://github.com/cmj4088/TAO/releases"
fi

echo ""
echo "=========================================="
echo "  v$VERSION 发版完成！"
echo "=========================================="