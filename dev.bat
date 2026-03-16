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

echo.
echo All services running!
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:4000
echo   agent.md:  http://localhost:5173/agent.md
echo.
echo Close the Backend and Frontend windows to stop.
echo To stop Postgres and Redis run: docker compose stop postgres redis
