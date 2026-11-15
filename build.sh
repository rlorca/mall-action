#!/usr/bin/env bash
# Production build: compiles the Bevy app to wasm, runs wasm-bindgen and assembles static files in dist/.
# The output uses only relative URLs, so it works from any sub-path (e.g. https://user.github.io/mall-action/).
#
# Requirements: a Rust toolchain with the wasm32-unknown-unknown target, and the wasm-bindgen CLI at EXACTLY
# the version pinned in app/Cargo.toml (0.2.130):  cargo install wasm-bindgen-cli --version 0.2.130 --locked
set -euo pipefail
cd "$(dirname "$0")"

WB_VERSION="0.2.130"
if ! command -v wasm-bindgen >/dev/null; then
  echo "wasm-bindgen not found. Install it: cargo install wasm-bindgen-cli --version ${WB_VERSION} --locked" >&2
  exit 1
fi
if [ "$(wasm-bindgen --version | awk '{print $2}')" != "${WB_VERSION}" ]; then
  echo "wasm-bindgen CLI must be ${WB_VERSION} (found $(wasm-bindgen --version))" >&2
  exit 1
fi

export CARGO_INCREMENTAL=0
cargo build -p mall-app --release --target wasm32-unknown-unknown

rm -rf dist
mkdir -p dist
wasm-bindgen --target web --no-typescript --out-dir dist target/wasm32-unknown-unknown/release/mall-app.wasm
cp app/web/index.html dist/index.html
if command -v wasm-opt >/dev/null; then
  wasm-opt -Os dist/mall-app_bg.wasm -o dist/mall-app_bg.wasm
fi
touch dist/.nojekyll
ls -la dist
