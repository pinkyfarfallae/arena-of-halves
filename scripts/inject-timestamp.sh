#!/bin/bash
# Inject build timestamp into index.html after build
BUILD_TIMESTAMP=$(date +%s%3N)
BUILD_FILE="./build/index.html"

if [ -f "$BUILD_FILE" ]; then
  # For macOS (BSD sed)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/{BUILD_TIMESTAMP}/$BUILD_TIMESTAMP/g" "$BUILD_FILE"
  else
    # For Linux (GNU sed)
    sed -i "s/{BUILD_TIMESTAMP}/$BUILD_TIMESTAMP/g" "$BUILD_FILE"
  fi
  echo "✓ Build timestamp injected: $BUILD_TIMESTAMP"
else
  echo "✗ Build file not found: $BUILD_FILE"
  exit 1
fi
