@echo off
rem Tiny-TID ver6 local check: start/stop upstream proxy (8001) + wrangler dev (8787).
rem Requires: python, bun (bun install must have been run once).
rem   dev-local.bat          start both in separate windows (applies D1 migrations)
rem   dev-local.bat status   check ports
rem   dev-local.bat stop     close both windows
setlocal
cd /d "%~dp0."
if /i "%~1"=="stop" goto :stop
if /i "%~1"=="status" goto :status
if not "%~1"=="" (
  echo Usage: %~nx0 [status ^| stop]
  exit /b 1
)
goto :start
:start
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] python not found. Install Python first.
  exit /b 1
)
where bun >nul 2>&1
if errorlevel 1 (
  echo [ERROR] bun not found. Install bun first.
  exit /b 1
)
where worker-build >nul 2>&1
if errorlevel 1 (
  echo [ERROR] worker-build not found. Run cargo install worker-build first.
  echo          Also required: rustup target add wasm32-unknown-unknown
  exit /b 1
)
if not exist "node_modules\wrangler" (
  echo [ERROR] node_modules missing. Run bun install first.
  exit /b 1
)
if not exist ".dev.vars" (
  echo UPSTREAM_ORIGIN="http://127.0.0.1:8001"> ".dev.vars"
  echo [INFO] Created .dev.vars. For push checks, append VAPID_PRIVATE_KEY / VAPID_SUBJECT.
)
echo [1/3] Applying D1 local migrations...
call bunx wrangler d1 migrations apply tiny-tid --local
if errorlevel 1 (
  echo [ERROR] Migration failed.
  exit /b 1
)
echo [2/3] Starting upstream proxy ^(port 8001^)...
start "Tiny-TID proxy" cmd /k python dev_proxy.py 8001 .
timeout /t 3 /nobreak >nul
echo [3/3] Starting worker ^(port 8787^)...
start "Tiny-TID worker" cmd /k bunx wrangler dev --port 8787
echo.
echo Started:
echo   view : http://localhost:8787/
echo   api  : http://localhost:8787/api/view?station=%%E8%%8C%%A8%%E6%%9C%%A8^&pass=hide
echo Stop with: %~nx0 stop
goto :eof
:status
netstat -ano | findstr "LISTENING" | findstr ":8001" >nul
if errorlevel 1 ( echo [--] proxy  :8001 stopped ) else ( echo [OK] proxy  :8001 running )
netstat -ano | findstr "LISTENING" | findstr ":8787" >nul
if errorlevel 1 ( echo [--] worker :8787 stopped ) else ( echo [OK] worker :8787 running )
goto :eof
:stop
taskkill /F /FI "WINDOWTITLE eq Tiny-TID proxy" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Tiny-TID worker" >nul 2>&1
echo Stop signal sent. Close any leftover windows manually.
goto :eof
