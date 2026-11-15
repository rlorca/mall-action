#!/usr/bin/env bash
# Production build: static files in dist/ (relative URLs: works from any sub-path).
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown -p mall-action
rm -rf dist && mkdir -p dist
cp target/wasm32-unknown-unknown/release/mall-action.wasm dist/mall-action.wasm
cp web/index.html web/mq_js_bundle.js dist/
echo "built dist/ ($(du -h dist/mall-action.wasm | cut -f1) wasm)"
