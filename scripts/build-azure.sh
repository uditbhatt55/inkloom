#!/usr/bin/env bash
# Builds a self-contained Linux bundle for Azure App Service (works from Windows Git Bash or Linux) and writes azure-app.zip.
# Building on App Service itself is too slow on B1 (npm install alone took 9 minutes and the build timed out).
# Deploy:  az webapp deploy -g inkloom-web-rg -n inkloom-specfix --src-path azure-app.zip --type zip
# The app's startup command is "node server.js"; keys come from the App Service settings, never from this bundle.
set -euo pipefail
cd "$(dirname "$0")/.."

SHARP=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("node_modules/sharp/package.json", "utf8")).version)')
rm -rf .next out-azure azure-app.zip
NEXT_OUTPUT=standalone npx next build

cp -r .next/standalone out-azure
mkdir -p out-azure/.next
cp -r .next/static out-azure/.next/static
cp -r public out-azure/public
rm -f out-azure/.env*

# sharp is the only native runtime dependency: add its Linux binaries next to the Windows ones
tmp=$(mktemp -d)
npm install --prefix "$tmp" --no-save --no-package-lock --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc "sharp@$SHARP" > /dev/null
mkdir -p out-azure/node_modules/@img
cp -r "$tmp/node_modules/@img/sharp-linux-x64" "$tmp/node_modules/@img/sharp-libvips-linux-x64" out-azure/node_modules/@img/
rm -rf "$tmp"

if command -v zip > /dev/null; then (cd out-azure && zip -qr ../azure-app.zip .)
else (cd out-azure && /c/Windows/System32/tar.exe -a -c -f ../azure-app.zip .)
fi
echo "azure-app.zip ready"
