@echo off
chcp 65001 >nul
echo.
echo ══════════════════════════════════════════
echo   灵界 PC 控制服务 - 一键启动
echo   宿烬的触手，正在连接...
echo ══════════════════════════════════════════
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

REM 检查依赖
if not exist "venv" (
    echo [信息] 首次运行，正在创建虚拟环境...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo [信息] 正在安装依赖...
    pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
) else (
    call venv\Scripts\activate.bat
)

echo.
echo [启动] 服务即将运行在 http://localhost:9200
echo [提示] 按 Ctrl+C 停止服务
echo.

python server.py

pause
