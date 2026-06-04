#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Butchi API Deploy ==="

# Apply D1 migrations
echo "-> Applying D1 migrations..."
pnpm --filter api exec wrangler d1 migrations apply butchi-db --remote

# Deploy API worker
echo "-> Deploying API worker..."
pnpm --filter api exec wrangler deploy

# Build dashboard
echo "-> Building dashboard..."
pnpm --filter dashboard build

# Deploy dashboard
echo "-> Deploying dashboard..."
pnpm --filter api exec wrangler pages deploy "$SCRIPT_DIR/packages/dashboard/dist" --project-name butchi-dashboard

echo "=== Deploy complete ==="
