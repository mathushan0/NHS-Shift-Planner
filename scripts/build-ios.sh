#!/usr/bin/env bash
# NHS Shift Planner — iOS Build Script
# Triggers an EAS Build for iOS.
# Usage: ./scripts/build-ios.sh [profile]
#   profile: development | preview | production (default: development)

set -euo pipefail

PROFILE="${1:-development}"
VALID_PROFILES=("development" "preview" "production")

# ─────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────
if [[ ! " ${VALID_PROFILES[*]} " =~ " ${PROFILE} " ]]; then
  echo "❌ Invalid profile: ${PROFILE}"
  echo "   Valid profiles: ${VALID_PROFILES[*]}"
  exit 1
fi

if ! command -v eas &> /dev/null; then
  echo "❌ EAS CLI not found. Run: npm install -g eas-cli"
  exit 1
fi

if ! eas whoami &> /dev/null 2>&1; then
  echo "❌ Not logged in to EAS. Run: eas login"
  exit 1
fi

# ─────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────
echo "🏗️  Starting EAS Build — iOS [${PROFILE}]"
echo ""

case "$PROFILE" in
  development)
    echo "📱 Building development client (custom dev client for Expo bare workflow)"
    echo "   This will install on your device via QR code."
    echo ""
    eas build \
      --platform ios \
      --profile development \
      --non-interactive
    ;;
  preview)
    echo "🧪 Building preview build for TestFlight"
    echo ""
    eas build \
      --platform ios \
      --profile preview \
      --non-interactive
    echo ""
    echo "To submit to TestFlight after build completes:"
    echo "  eas submit --platform ios --profile preview --latest"
    ;;
  production)
    echo "🚀 Building production build for App Store"
    echo ""
    read -p "Are you sure you want to build production? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
    eas build \
      --platform ios \
      --profile production \
      --non-interactive
    echo ""
    echo "To submit to App Store after build completes:"
    echo "  eas submit --platform ios --profile production --latest"
    ;;
esac

echo ""
echo "✅ Build submitted to EAS!"
echo "   Track progress: https://expo.dev"
echo "   Or run: eas build:list --platform ios"
