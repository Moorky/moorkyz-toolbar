@echo off
REM Windows CMD / PowerShell launcher for the tools.moorkyz.com CLI.
node "%~dp0tools.moorkyz.com.cjs" %*
exit /b %ERRORLEVEL%