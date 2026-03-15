#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Setup .env if missing
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Creating backend/.env from .env.example..."
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
fi

# Start Postgres + Redis
echo "Starting Postgres and Redis..."
docker compose -f "$ROOT/docker-compose.yml" up -d postgres redis

echo "Waiting for services to be healthy..."
sleep 5

# Backend
echo "Installing backend dependencies..."
cd "$ROOT/backend"
npm install

echo "Pushing database schema..."
npx prisma db push

echo "Starting backend..."
npm run dev &
BACKEND_PID=$!

# Frontend
echo "Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install

echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "All services running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop everything."

cleanup() {
  echo "Stopping dev servers..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  docker compose -f "$ROOT/docker-compose.yml" stop postgres redis
}
trap cleanup EXIT INT TERM

wait $BACKEND_PID $FRONTEND_PID
