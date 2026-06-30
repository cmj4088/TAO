@echo off
chcp 65001 >nul
echo ============================================
echo   TAO 演示系统启动中...
echo ============================================
echo.

echo [1/3] 启动后端服务 (端口 8002)...
start "TAO-Backend" cmd /c "cd /d %~dp0..\backend && venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8002"

echo [2/3] 启动前端开发服务器 (端口 5173)...
start "TAO-Vite" cmd /c "cd /d %~dp0..\frontend && npm run dev:vite"

echo [3/3] 等待 8 秒后启动本地窗口...
timeout /t 8 /nobreak >nul
start "TAO-App" cmd /c "cd /d %~dp0..\frontend && npm run dev:electron"

echo.
echo ============================================
echo   启动完成！本地窗口已打开
echo   关闭此窗口不会影响后端和前端运行
echo ============================================
pause
