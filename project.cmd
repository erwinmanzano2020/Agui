@echo off
where node >nul 2>nul
if errorlevel 1 goto missing
node "%~dp0project.mjs" %*
set "workflow_exit=%errorlevel%"
echo ExitCode=%workflow_exit%
if "%~1"=="" pause
exit /b %workflow_exit%
:missing
echo Node.js 20 or later is required. No inputs were collected.
pause
exit /b 1
