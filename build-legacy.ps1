#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "Building legacy bundles..."

npx --yes esbuild assets/js/legacy-entry-index.js --bundle --format=iife --target=es2015 --outfile=assets/js/legacy-index.js --log-level=error
if($LASTEXITCODE -ne 0){ throw "Failed to build legacy-index.js" }

npx --yes esbuild assets/js/legacy-entry-tid.js --bundle --format=iife --target=es2015 --outfile=assets/js/legacy-tid.js --log-level=error
if($LASTEXITCODE -ne 0){ throw "Failed to build legacy-tid.js" }

Write-Host "Done: assets/js/legacy-index.js, assets/js/legacy-tid.js"
