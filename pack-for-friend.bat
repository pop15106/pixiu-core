@echo off
chcp 65001 >nul
setlocal

echo ╔══════════════════════════════════════════╗
echo ║   Pixiu 母艦打包工具 — pack-for-friend   ║
echo ╚══════════════════════════════════════════╝
echo.

set "PIXIU_ROOT=%~dp0"
set "PIXIU_ROOT=%PIXIU_ROOT:~0,-1%"
set "OUTPUT=%USERPROFILE%\Desktop\pixiu-mothership.zip"

echo [1/3] 母艦路徑: %PIXIU_ROOT%
echo [1/3] 輸出路徑: %OUTPUT%
echo.

REM 先 git pull 確保最新版
cd /d "%PIXIU_ROOT%"
git pull origin master 2>nul && echo [1/3] Git 同步完成 || echo [1/3] （略過 git 同步）
echo.

REM 刪除舊的 zip
if exist "%OUTPUT%" (
    del "%OUTPUT%"
    echo 已刪除舊版 zip
)

echo [2/3] 打包中...
powershell -Command ^
    "Compress-Archive -Force -Path @('%PIXIU_ROOT%\.agent', '%PIXIU_ROOT%\user_rules.md', '%PIXIU_ROOT%\CLAUDE.md', '%PIXIU_ROOT%\SKILLS_INDEX.md', '%PIXIU_ROOT%\setup.bat') -DestinationPath '%OUTPUT%'"

if %errorlevel% neq 0 (
    echo [錯誤] 打包失敗！
    pause
    exit /b 1
)

echo [3/3] 完成！
echo.
echo ✅ 已輸出到桌面: pixiu-mothership.zip
for %%A in ("%OUTPUT%") do echo 📦 檔案大小: %%~zA bytes
echo.
echo 告訴朋友：
echo   1. 解壓到任意資料夾（例如 C:\PixiuCore）
echo   2. 執行 setup.bat
echo   3. 重啟終端機 / Antigravity
echo.
set /p OPEN=是否開啟桌面資料夾？(y/n):
if /i "%OPEN%"=="y" explorer "%USERPROFILE%\Desktop"
pause
