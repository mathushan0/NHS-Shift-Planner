#!/usr/bin/env bash
# NHS Shift Planner — Development Setup Script
# Run once after cloning the repo.
# Usage: ./scripts/setup.sh

set -euo pipefail

# ─────────────────────────────────────────────
# Colours
# ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

info()    { echo -e "${BLUE}[setup]${NC} $1"; }
success() { echo -e "${GREEN}[setup]${NC} ✅ $1"; }
warn()    { echo -e "${YELLOW}[setup]${NC} ⚠️  $1"; }
error()   { echo -e "${RED}[setup]${NC} ❌ $1"; exit 1; }

# ─────────────────────────────────────────────
# Node version check
# ─────────────────────────────────────────────
info "Checking Node.js version..."
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  error "Node.js 20+ required. Current: $(node --version). Install via nvm: nvm install 20"
fi
success "Node.js $(node --version)"

# ─────────────────────────────────────────────
# Check for EAS CLI
# ─────────────────────────────────────────────
info "Checking EAS CLI..."
if ! command -v eas &> /dev/null; then
  warn "EAS CLI not found. Installing..."
  npm install -g eas-cli
fi
success "EAS CLI $(eas --version)"

# ─────────────────────────────────────────────
# Install npm dependencies
# ─────────────────────────────────────────────
info "Installing npm dependencies..."
npm install
success "npm dependencies installed"

# ─────────────────────────────────────────────
# Environment setup
# ─────────────────────────────────────────────
if [[ ! -f ".env.local" ]]; then
  info "Creating .env.local from .env.example..."
  cp .env.example .env.local
  warn ".env.local created — please fill in your Supabase URL and anon key before running the app."
else
  info ".env.local already exists — skipping"
fi

# ─────────────────────────────────────────────
# Supabase CLI check (optional)
# ─────────────────────────────────────────────
info "Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
  warn "Supabase CLI not found. Install it for local development:"
  warn "  brew install supabase/tap/supabase   (macOS)"
  warn "  or: https://supabase.com/docs/guides/cli"
else
  success "Supabase CLI $(supabase --version)"
  info "Starting local Supabase (Docker required)..."
  if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    supabase start || warn "Could not start local Supabase — Docker may not be running"
  else
    warn "Docker not running — skipping local Supabase start"
  fi
fi

# ─────────────────────────────────────────────
# iOS setup (macOS only)
# ─────────────────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  info "macOS detected — checking iOS build tools..."

  # Check Xcode
  if ! xcode-select -p &> /dev/null; then
    warn "Xcode not found. Install from the App Store or run: xcode-select --install"
  else
    success "Xcode at $(xcode-select -p)"
  fi

  # Check CocoaPods
  if ! command -v pod &> /dev/null; then
    warn "CocoaPods not found. Installing..."
    sudo gem install cocoapods
  else
    success "CocoaPods $(pod --version)"
  fi

  # Install pods if ios/ directory exists
  if [[ -d "ios" ]]; then
    info "Installing CocoaPods dependencies..."
    cd ios && pod install && cd ..
    success "CocoaPods installed"
  fi

  # Fastlane gems
  if [[ -f "fastlane/Gemfile" ]]; then
    info "Installing Fastlane gems..."
    cd fastlane && bundle install && cd ..
    success "Fastlane gems installed"
  fi
else
  info "Non-macOS environment — skipping iOS-specific setup"
  info "iOS builds run in the cloud via EAS Build (no local Xcode needed)"
fi

# ─────────────────────────────────────────────
# EAS login
# ─────────────────────────────────────────────
info "Checking EAS login status..."
if ! eas whoami &> /dev/null 2>&1; then
  warn "Not logged in to EAS. Run: eas login"
else
  success "Logged in as $(eas whoami)"
fi

# ─────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} NHS Shift Planner — Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Fill in .env.local with your Supabase credentials"
echo "  2. Run: npm start              (start Metro bundler)"
echo "  3. Run: ./scripts/build-ios.sh (build iOS dev client)"
echo ""
