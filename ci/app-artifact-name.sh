#!/bin/sh
# Prints the artifact name of the simulator build for the committed app files.
# Build (build.yml) uploads under this name and E2E (e2e.yml) downloads by it, so both must use this script.
# Only the app's own files count: changing flows, docs or workflows keeps the name, and the build is reused.
set -e
XCODE=$(xcodebuild -version | head -1 | tr ' ' '-')
HASH=$( (git ls-files -s -- src assets app.json package.json package-lock.json tsconfig.json; echo "$XCODE") | shasum -a 256 | cut -c1-16)
echo "ios-sim-app-$XCODE-$HASH"
