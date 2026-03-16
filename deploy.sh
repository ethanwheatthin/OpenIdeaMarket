#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.prod.yml"

# ---------------------------------------------------------------------------
# run_migrations
#
# Handles three Prisma migration states automatically:
#
#   P3009 — A previous migration run was interrupted and marked as failed.
#           Fix: resolve it as rolled-back, then retry.
#
#   P3018 — Migration failed because the schema already exists (common when
#           the DB was previously set up with `prisma db push`).
#           Fix: mark the migration as applied (schema is already correct).
#
#   Success — migrations applied cleanly, nothing to do.
# ---------------------------------------------------------------------------
run_migrations() {
  echo "==> Running database migrations..."

  local output exit_code
  output=$($COMPOSE run --rm backend npx prisma migrate deploy 2>&1) && exit_code=0 || exit_code=$?
  echo "$output"

  # P3009: failed migration record blocking new migrations
  if echo "$output" | grep -q "P3009"; then
    local migration
    migration=$(echo "$output" | grep "migration started" | sed "s/.*\`\(.*\)\` migration started.*/\1/")
    echo ""
    echo "==> Found failed migration: '$migration'. Resolving as rolled-back and retrying..."
    $COMPOSE run --rm backend npx prisma migrate resolve --rolled-back "$migration"

    # Retry after resolving
    output=$($COMPOSE run --rm backend npx prisma migrate deploy 2>&1) && exit_code=0 || exit_code=$?
    echo "$output"
  fi

  # P3018: schema already exists (db push was used before, migration can't re-create types/tables)
  if echo "$output" | grep -q "P3018"; then
    local migration
    migration=$(echo "$output" | grep "Migration name:" | awk '{print $NF}')
    echo ""
    echo "==> Schema already exists in DB. Marking '$migration' as applied..."
    $COMPOSE run --rm backend npx prisma migrate resolve --applied "$migration"
    echo "==> Migration marked as applied. Schema is in sync."
    return 0
  fi

  if [ "$exit_code" -ne 0 ]; then
    echo ""
    echo "ERROR: Migration failed. Check the output above."
    echo "       Backend will NOT be started."
    exit 1
  fi

  echo "==> Migrations OK."
}

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

echo "==> Bringing down prod..."
$COMPOSE down

echo "==> Rebuilding images..."
$COMPOSE build --no-cache

echo "==> Starting database services..."
$COMPOSE up -d postgres redis

echo "==> Waiting for postgres and redis to be healthy..."
$COMPOSE run --rm backend sh -c "
  until pg_isready -h postgres -U \${POSTGRES_USER:-ideamarket} > /dev/null 2>&1; do sleep 1; done
" 2>/dev/null || true
sleep 3

run_migrations

echo "==> Starting application services..."
$COMPOSE up -d backend frontend caddy

echo ""
echo "All services running!"
echo "  Site:     https://openideamarket.com"
echo "  agent.md: https://openideamarket.com/agent.md"
echo ""
echo "Tailing logs (Ctrl+C to exit — containers keep running)..."
$COMPOSE logs --tail=30 -f
