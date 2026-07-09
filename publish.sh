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
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
sed -i "s/VERSION = \".*\"/VERSION = \"$VERSION\"/" backend/app/main.py
echo "  OK: package.json + backend/app/main.py → $VERSION"

# 2. 构建前端
echo "[2/6] 构建前端..."
cd frontend
npm run build --silent
echo "  OK"

# 3. 构建安装包 + 手动上传到 GitHub（electron-builder 自动上传大文件不稳定）
echo "[3/6] 构建安装包..."
export GH_TOKEN=$(gh auth token)
npx electron-builder --win --publish never
echo "  OK: 安装包已构建"

# 手动上传到 GitHub Release
echo "[3.5/6] 上传到 GitHub Release..."
cd "../前端"

# 确保 latest.yml 存在
if [ ! -f "latest.yml" ]; then
  echo "  错误: latest.yml 未找到"
  exit 1
fi

# 从 latest.yml 获取 exe 文件名
EXE_NAME=$(grep "^path:" latest.yml | head -1 | sed 's/path: //' | tr -d '[:space:]')
EXE_BLOCKMAP="${EXE_NAME}.blockmap"

# electron-builder 可能用 productName（中文）命名 exe，复制到 latest.yml 引用的英文名
PRODUCT_EXE="教务办智能体 Setup ${VERSION}.exe"
if [ -f "$PRODUCT_EXE" ] && [ ! -f "$EXE_NAME" ]; then
  cp "$PRODUCT_EXE" "$EXE_NAME"
  echo "  OK: 复制 $PRODUCT_EXE → $EXE_NAME"
fi
if [ -f "${PRODUCT_EXE}.blockmap" ] && [ ! -f "$EXE_BLOCKMAP" ]; then
  cp "${PRODUCT_EXE}.blockmap" "$EXE_BLOCKMAP"
fi

# 确保 Release 存在（electron-builder 可能没创建成功）
if ! gh release view "v$VERSION" &>/dev/null; then
  gh release create "v$VERSION" --title "v$VERSION" --notes "教务办·智能体 v$VERSION 发布" --draft=false
  echo "  OK: 创建 Release v$VERSION"
fi

# 上传文件
echo "  上传中..."
gh release upload "v$VERSION" "$EXE_NAME" "$EXE_BLOCKMAP" "latest.yml" --clobber
echo "  OK: $EXE_NAME + $EXE_BLOCKMAP + latest.yml 已上传"

# 4. 打包后端
echo "[4/6] 打包后端..."
cd "$(dirname "$0")"
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
cd "$(dirname "$0")"
git add frontend/package.json backend/app/main.py
git commit -m "chore: bump version to $VERSION" || echo "  (无新变更，跳过提交)"
git tag -af "v$VERSION" -m "v$VERSION"
git push origin combined-test --tags
echo "  OK: 已推送 combined-test + v$VERSION"

# 6. 验证
echo "[6/6] 验证..."
ASSETS=$(gh release view "v$VERSION" --json assets -q '.assets[].name' 2>/dev/null)
echo "$ASSETS"
if echo "$ASSETS" | grep -q "latest.yml" && echo "$ASSETS" | grep -q ".exe"; then
  echo "  OK: Release 文件完整"
else
  echo "  ⚠ 警告: Release 文件不完整，请手动检查"
fi

echo ""
echo "=========================================="
echo "  v$VERSION 发版完成！"
echo "=========================================="