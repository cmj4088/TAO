@echo off
chcp 65001 >nul
set LOG=%~dp0startup.log
echo === TAO 启动 %date% %time% === > "%LOG%"

echo ============================================
echo   TAO 演示系统启动中...
echo   日志: demo\startup.log
echo ============================================
echo.

echo [1/3] 启动后端 (端口 8002)...
echo [1/3] 后端 >> "%LOG%"
start "TAO-Backend" /D "%~dp0..\backend" cmd /c "venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 2>> %LOG%"

echo [2/3] 启动前端 Vite (端口 5173)...
echo [2/3] 前端 Vite >> "%LOG%"
start "TAO-Vite" /D "%~dp0..\frontend" cmd /c "npm run dev:vite 2>> %LOG%"

echo [3/3] 等 10 秒后启动 Electron...
timeout /t 10 /nobreak >nul

echo [3/3] 启动 Electron >> "%LOG%"
start "TAO-App" /D "%~dp0..\frontend" cmd /c "npm run dev:electron 2>> %LOG%"

echo.
echo ============================================
echo   启动完成！
echo   如有问题查看 demo\startup.log
echo ============================================
echo === 完成 %time% === >> "%LOG%"
pause
