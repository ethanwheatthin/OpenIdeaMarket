@echo off
setlocal

set ROOT=%~dp0
set COMPOSE=docker compose -f "%ROOT%docker-compose.prod.yml"

:: Check Docker is running
echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  echo Waiting for Docker to start ^(this may take ~30 seconds^)...
  :waitdocker
  timeout /t 5 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto waitdocker
  echo Docker is ready.
)

echo =^> Bringing down prod...
%COMPOSE% down

echo =^> Rebuilding images...
%COMPOSE% build --no-cache

echo =^> Starting prod...
%COMPOSE% up -d

echo.
echo All services running!
echo   Site:     https://openideamarket.com
echo   agent.md: https://openideamarket.com/agent.md
echo.
echo Tailing logs ^(Ctrl+C to exit -- containers keep running^)...
%COMPOSE% logs --tail=30 -f
