#!/bin/bash
set -e

echo "=== Butchi Deploy ==="

# Install dependencies
echo "-> Installing dependencies..."
pnpm install

# Apply D1 migrations
echo "-> Applying D1 migrations..."
pnpm --filter api exec wrangler d1 migrations apply butchi-db --remote

# Build dashboard (SSG)
echo "-> Building dashboard..."
pnpm --filter dashboard build

# Deploy single Worker with assets
echo "-> Deploying Worker..."
pnpm --filter api exec wrangler deploy

echo "=== Deploy complete ==="
echo "URL: https://butchi-api.ngoclamlai.workers.dev"
