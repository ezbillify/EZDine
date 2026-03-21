#!/bin/bash

# EZDine Desktop Release Automator
# This script bumps version, builds the bridge, builds the app, and publishes to GitHub.

set -e # Exit on error

echo "🚀 Starting EZDine Desktop Release Pipeline..."

# 1. Bump version in Desktop App
echo "📦 Bumping version..."
cd apps/desktop
# Using node instead of npm version to avoid pnpm workspace issues
node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8")); const parts = pkg.version.split("."); parts[2] = parseInt(parts[2]) + 1; pkg.version = parts.join("."); fs.writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n"); console.log(pkg.version);' > /tmp/new_version.txt
NEW_VERSION=$(cat /tmp/new_version.txt)
echo "   New Version: $NEW_VERSION"

# 2. Build the latest Print Bridge
echo "🖨️ Building latest Print Bridge..."
cd ../../print-bridge
npm run pkg
cp dist/ezdine-print-bridge-macos ../apps/desktop/bridge/
cp dist/ezdine-print-bridge-win.exe ../apps/desktop/bridge/

# 3. Build Web POS (optional but good to ensure dist is ready)
# cd ../apps/web && pnpm build && cd ..

# 4. Commit and Tag in Git
echo "Git: Committing version bump..."
cd ..
git add apps/desktop/package.json apps/desktop/bridge/
git commit -m "chore: release desktop v$NEW_VERSION" || echo "No changes to commit"
git tag "desktop-v$NEW_VERSION" || echo "Tag already exists"

# 5. Push to GitHub
echo "Git: Pushing to origin..."
git push origin main --tags

# 6. Build and Publish the Desktop App
echo "🏗️ Building and Publishing App to GitHub..."
cd apps/desktop

# Determine platform for builds
if [[ "$OSTYPE" == "darwin"* ]]; then
    # On Mac, we can build both if configured, but let's do mac first
    echo "Running build:mac and build:win with publish..."
    pnpm exec electron-builder --mac --win --publish always -c.mac.identity=null -c.win.verifyUpdateCodeSignature=false
else
    echo "Running build:win with publish..."
    pnpm exec electron-builder --win --publish always -c.win.verifyUpdateCodeSignature=false
fi

echo "✅ DONE! Version $NEW_VERSION has been pushed and published."
echo "Users will see the update notification the next time they open the app."
