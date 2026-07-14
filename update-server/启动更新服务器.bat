@echo off
chcp 65001 >nul
echo ===========================================
echo   教务办·智能体 更新服务器
echo   启动后教室电脑即可检测到更新
echo ===========================================
echo.
echo 你的IP: 10.220.122.235
echo 端口: 8080
echo 更新地址: http://10.220.122.235:8080/update/
echo.
echo 按 Ctrl+C 停止服务器
echo ===========================================
echo.

python3 -m http.server 8080
pause
