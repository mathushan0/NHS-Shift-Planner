# NHS Shift Planner — Dev/CI Dockerfile
# Used for: local development environment, CI linting/testing
# NOT used for: running the iOS app (that requires EAS Build)

FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install EAS CLI globally
RUN npm install -g eas-cli@latest expo-cli@latest

# Set working directory
WORKDIR /app

# Copy package files first (layer caching)
COPY package.json package-lock.json* yarn.lock* .npmrc* ./

# Install dependencies
RUN npm install --frozen-lockfile || npm install

# Copy the rest of the source
COPY . .

# Default command: run tests
CMD ["npm", "test"]
