@echo off
chcp 65001 >nul

echo ============================================
echo   TAO 演示系统启动中...
echo ============================================
echo.

echo [0] 清理旧进程...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
timeout /t 2 /nobreak >nul
echo   已清理

echo [1/3] 启动后端 (端口 8002)...
start "TAO-Backend" cmd /c "cd /d %~dp0..\backend && venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8002"
echo   后端已启动

echo [2/3] 启动前端 Vite (端口 5173)...
cd /d %~dp0..\frontend
start "TAO-Vite" /B npx vite --host 0.0.0.0 --port 5173
echo   前端已启动

echo [3/3] 等待前端就绪...
:waitloop
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:5173 2>nul
if %errorlevel% equ 0 goto ready
goto waitloop

:ready
echo   前端就绪，启动 Electron...
start "TAO-App" /B npx electron .

echo.
echo ============================================
echo   启动完成！本地窗口即将弹出
echo ============================================
pause
