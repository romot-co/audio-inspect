#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8080}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run this demo server."
  echo "Install Node.js and rerun this script."
  exit 1
fi

exec node "$SCRIPT_DIR/serve-demo.mjs" "$PORT"
