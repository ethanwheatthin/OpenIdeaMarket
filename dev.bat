@echo off
setlocal

set ROOT=%~dp0

:: Setup .env if missing
if not exist "%ROOT%backend\.env" (
  echo Creating backend\.env from .env.example...
  copy "%ROOT%backend\.env.example" "%ROOT%backend\.env"
)

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

:: Free port 5432 if a local Postgres service is running
netstat -ano | findstr ":5432 " >nul 2>&1
if not errorlevel 1 (
  echo Port 5432 is in use. Stopping local PostgreSQL service...
  for /f "tokens=1" %%s in ('sc query state^= all ^| findstr /i "postgresql"') do (
    net stop %%s >nul 2>&1
  )
  timeout /t 3 /nobreak >nul
)

:: Start Postgres + Redis
echo Starting Postgres and Redis...
docker compose -f "%ROOT%docker-compose.yml" up -d postgres redis

echo Waiting for services to be healthy...
timeout /t 8 /nobreak >nul

:: Backend
echo Installing backend dependencies...
cd /d "%ROOT%backend"
call npm install

echo Pushing database schema...
call npx prisma db push

echo Starting backend...
start "Backend" cmd /k "npm run dev"

:: Frontend
echo Installing frontend dependencies...
cd /d "%ROOT%frontend"
call npm install

echo Starting frontend...
start "Frontend" cmd /k "npm run dev"

:: Cloudflare Tunnel
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared not found. Downloading...
  curl -L -o "%ROOT%cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  set CLOUDFLARED="%ROOT%cloudflared.exe"
) else (
  set CLOUDFLARED=cloudflared
)

if exist "%ROOT%tunnel.log" del "%ROOT%tunnel.log"

echo Starting Cloudflare Tunnel...
start "Tunnel" cmd /c "%CLOUDFLARED% tunnel --url http://localhost:4000 2>\"%ROOT%tunnel.log\""

echo Waiting for tunnel URL...
:waittunnel
timeout /t 3 /nobreak >nul
findstr /i "trycloudflare.com" "%ROOT%tunnel.log" >nul 2>&1
if errorlevel 1 goto waittunnel

:: Extract just the URL
for /f "tokens=*" %%u in ('powershell -NoProfile -Command "(Select-String -Path \"%ROOT%tunnel.log\" -Pattern 'https://[a-z0-9\-]+\.trycloudflare\.com').Matches[0].Value"') do set TUNNEL_URL=%%u

:: Update SITE_URL in .env
powershell -NoProfile -Command "(Get-Content '%ROOT%backend\.env') -replace 'SITE_URL=.*', 'SITE_URL=%TUNNEL_URL%' | Set-Content '%ROOT%backend\.env'"

echo.
echo All services running!
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:4000
echo   Public:    %TUNNEL_URL%
echo   agent.md:  %TUNNEL_URL%/agent.md
echo.
echo Close the Backend, Frontend, and Tunnel windows to stop.
echo To stop Postgres and Redis run: docker compose stop postgres redis
