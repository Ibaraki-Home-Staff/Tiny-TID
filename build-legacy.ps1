#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "Versioning static assets..."
node scripts/version-assets.mjs
if($LASTEXITCODE -ne 0){ throw "Failed to version assets" }

Write-Host "Building legacy bundles..."
bunx esbuild assets/js/legacy-entry-index.js --bundle --format=iife --target=es2015 --outfile=assets/js/legacy-index.js --log-level=error
if($LASTEXITCODE -ne 0){ throw "Failed to build legacy-index.js" }

bunx esbuild assets/js/legacy-entry-tid.js --bundle --format=iife --target=es2015 --outfile=assets/js/legacy-tid.js --log-level=error
if($LASTEXITCODE -ne 0){ throw "Failed to build legacy-tid.js" }

Write-Host "Done: assets/js/legacy-index.js, assets/js/legacy-tid.js"

bunx esbuild public/assets/js/legacy-entry-app.js --bundle --format=iife --target=es2015 --outfile=public/assets/js/legacy-app.js --log-level=error
if($LASTEXITCODE -ne 0){ throw "Failed to build legacy-app.js" }
