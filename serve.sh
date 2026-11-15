#!/usr/bin/env bash
# Dev server: build, then serve dist/ at http://localhost:8000/ (also try ?debug=1, ?seed=7, ?gallery=1).
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
echo "Serving http://localhost:8000/  (Ctrl-C to stop)"
exec python3 -m http.server 8000 --directory dist
