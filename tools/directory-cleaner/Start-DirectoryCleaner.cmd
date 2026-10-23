@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. No tools were installed.
  pause
  exit /b 1
)
node "%~dp0server.mjs"
if errorlevel 1 pause
