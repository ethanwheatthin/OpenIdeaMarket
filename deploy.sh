#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.prod.yml"

echo "==> Bringing down prod..."
$COMPOSE down

echo "==> Rebuilding images..."
$COMPOSE build --no-cache

echo "==> Starting prod..."
$COMPOSE up -d

echo ""
echo "All services running!"
echo "  Site:     https://openideamarket.com"
echo "  agent.md: https://openideamarket.com/agent.md"
echo ""
echo "Tailing logs (Ctrl+C to exit — containers keep running)..."
$COMPOSE logs --tail=30 -f
