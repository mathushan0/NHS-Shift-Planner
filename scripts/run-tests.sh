#!/usr/bin/env bash
# NHS Shift Planner — Test Runner Script
# Usage: ./scripts/run-tests.sh [--coverage] [--watch]

set -euo pipefail

COVERAGE=false
WATCH=false

for arg in "$@"; do
  case $arg in
    --coverage) COVERAGE=true ;;
    --watch)    WATCH=true ;;
    --help|-h)
      echo "Usage: ./scripts/run-tests.sh [--coverage] [--watch]"
      echo "  --coverage   Generate coverage report"
      echo "  --watch      Run in watch mode (interactive)"
      exit 0
      ;;
  esac
done

echo "🧪 NHS Shift Planner — Test Suite"
echo ""

# ─────────────────────────────────────────────
# TypeScript type check first
# ─────────────────────────────────────────────
echo "📝 Running TypeScript type check..."
npm run ts:check && echo "✅ Types OK" || { echo "❌ Type errors found"; exit 1; }
echo ""

# ─────────────────────────────────────────────
# ESLint
# ─────────────────────────────────────────────
echo "🔍 Running ESLint..."
npm run lint && echo "✅ Lint OK" || { echo "❌ Lint errors found"; exit 1; }
echo ""

# ─────────────────────────────────────────────
# Jest / Vitest tests
# ─────────────────────────────────────────────
echo "🏃 Running unit tests..."

JEST_ARGS="--passWithNoTests"

if $COVERAGE; then
  JEST_ARGS="$JEST_ARGS --coverage"
fi

if $WATCH; then
  JEST_ARGS="$JEST_ARGS --watch"
fi

# Set test environment variables
export EXPO_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key"
export EXPO_PUBLIC_APP_ENV="test"

npm test -- $JEST_ARGS

echo ""
echo "✅ All checks passed!"

if $COVERAGE; then
  echo ""
  echo "📊 Coverage report saved to: ./coverage/index.html"
fi
