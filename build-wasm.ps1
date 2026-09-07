#!/usr/bin/env pwsh
# Rebuilds the tid-core WASM bundle used by the SORAHOST node backend.
# Requires wasm-bindgen-cli matching Cargo.lock (install once):
#   cargo install wasm-bindgen-cli --vers 0.2.127
$ErrorActionPreference = "Stop"

Write-Host "Building tid-core wasm..."
cargo build -p tid-core --features wasm --target wasm32-unknown-unknown --release
if($LASTEXITCODE -ne 0){ throw "wasm build failed" }

Write-Host "Generating Node glue..."
wasm-bindgen --target nodejs --out-dir server/vendor --out-name tid_core_node target/wasm32-unknown-unknown/release/tid_core.wasm
if($LASTEXITCODE -ne 0){ throw "wasm-bindgen failed" }

Write-Host "Done: server/vendor/tid_core_node.js + tid_core_node_bg.wasm"
