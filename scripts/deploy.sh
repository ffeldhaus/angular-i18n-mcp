#!/bin/bash

# Exit on any error
set -e

# Validate argument
if [[ ! "$1" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: npm run deploy <major|minor|patch>"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: You have uncommitted changes. Please commit or stash them before deploying."
  exit 1
fi

# Run npm version
# This updates package.json and creates a git tag (with 'v' prefix by default)
echo "Increasing version ($1)..."
npm version "$1"

# Push changes and tags
echo "Pushing changes and tags to remote..."
git push && git push --tags

echo "Deploy process completed successfully."
