@echo off
REM Windows CMD / PowerShell launcher for the Moorkyz CLI.
node "%~dp0moorkyz.cjs" %*
exit /b %ERRORLEVEL%
