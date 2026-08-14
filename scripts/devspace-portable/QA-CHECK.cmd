@echo off
setlocal
title DevSpace - QA Check

echo ==============================================
echo DevSpace QA quick check
echo ==============================================
echo.
echo [1/1] Reading current DevSpace status...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" status
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ==============================================
echo Recommended troubleshooting order
echo ==============================================
echo 1. If local health is DOWN:
echo    Run START-CONNECTION.cmd
echo.
echo 2. If DevSpace looks ready but ChatGPT cannot use it:
echo    Run FORCE-RECONNECT.cmd
echo.
echo 3. If PID shows STALE or OneClick state is inconsistent:
echo    Run 09-REPAIR-STATE.cmd
echo.
echo 4. If ChatGPT still cannot connect:
echo    Refresh the DevSpace App actions in ChatGPT, then reconnect OAuth if needed.
echo.
echo 5. If the message says Microsoft Dev Tunnel is not logged in:
echo    Run 00-SETUP-OR-UPDATE.cmd and complete the Microsoft browser login.
echo.
echo 6. For detailed QA steps:
echo    Open QA-TROUBLESHOOTING.txt
echo.
pause
exit /b %EXIT_CODE%
