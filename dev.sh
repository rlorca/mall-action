#!/usr/bin/env bash
# Dev server: build, then serve dist/ at http://localhost:8000/  (add ?debug=1&seed=7 etc.)
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
echo "serving http://localhost:8000/  (Ctrl-C to stop)"
cd dist && python3 -m http.server 8000
