@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\wrangler\bin\wrangler.js (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts\local.mjs --open
if errorlevel 1 pause
