@echo off
setlocal
title DevSpace - Force Reconnect

echo Force reconnect will stop the recorded DevSpace stack, start it again, and verify status.
echo It keeps your local settings, tunnel identity, allowed folders, and workflow state.
echo.
set "DEVSPACE_ONECLICK_NO_PAUSE=1"
call "%~dp015-FORCE-RECONNECT.cmd"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Force reconnect completed successfully.
) else (
  echo Force reconnect failed. Run QA-CHECK.cmd and follow QA-TROUBLESHOOTING.txt.
)

pause
exit /b %EXIT_CODE%
