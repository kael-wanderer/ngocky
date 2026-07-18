#!/usr/bin/env bash
# Builds the SEA sidecar binary and copies Prisma engine into Tauri resources.
# The host's node is not usable as the SEA base (homebrew node is dynamically
# linked / not injectable), so we fetch an official self-contained node and
# inject the SEA blob into that.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VER="${SEA_NODE_VERSION:-v22.14.0}"
TRIPLE=$(rustc -vV | sed -n 's/host: //p')
case "$TRIPLE" in
    aarch64-apple-darwin) NODE_DIST="darwin-arm64" ;;
    x86_64-apple-darwin)  NODE_DIST="darwin-x64" ;;
    aarch64-*linux*)      NODE_DIST="linux-arm64" ;;
    x86_64-*linux*)       NODE_DIST="linux-x64" ;;
    *) echo "unsupported target triple: $TRIPLE" >&2; exit 1 ;;
esac

OUT_BIN="../desktop/src-tauri/binaries/ngocky-api-$TRIPLE"
RES="../desktop/src-tauri/resources"

# Fetch official self-contained node (cached) to use as the SEA injection base.
CACHE=".cache/node-$NODE_VER-$NODE_DIST"
SEA_BASE="$CACHE/bin/node"
if [[ ! -x "$SEA_BASE" ]]; then
    mkdir -p .cache
    echo "Downloading official node $NODE_VER ($NODE_DIST)..."
    curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-$NODE_DIST.tar.gz" \
        | tar -xz -C .cache
fi

# Desktop SQLite client must exist before bundling — esbuild statically includes
# the require('../../prisma/desktop-client') branch in database.ts.
npm run db:generate:desktop
npm run build:sidecar
# Generate the SEA blob with the SAME node the blob is injected into — the blob
# format is node-version-specific, so the host node must not be used here.
"$SEA_BASE" --experimental-sea-config sea-config.json

mkdir -p ../desktop/src-tauri/binaries "$RES/prisma"
cp "$SEA_BASE" "$OUT_BIN"
if [[ "$(uname)" == "Darwin" ]]; then codesign --remove-signature "$OUT_BIN"; fi
npx postject "$OUT_BIN" NODE_SEA_BLOB dist-sidecar/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    $( [[ "$(uname)" == "Darwin" ]] && echo --macho-segment-name NODE_SEA )
if [[ "$(uname)" == "Darwin" ]]; then codesign --sign - "$OUT_BIN"; fi

# Prisma library engine (provider-agnostic query engine). Workspace hoisting
# may place .prisma under the repo-root node_modules, so check both.
ENGINE=$(ls node_modules/.prisma/client/libquery_engine-*.node ../../node_modules/.prisma/client/libquery_engine-*.node 2>/dev/null | head -1 || true)
[[ -n "$ENGINE" ]] || { echo "prisma query engine not found; run 'npm run db:generate' first" >&2; exit 1; }
cp "$ENGINE" "$RES/prisma/query-engine.node"

# Per-provider baseline migration SQL (consumed at runtime via MIGRATIONS_DIR).
node scripts/generate-baselines.mjs

echo "Sidecar packaged: $OUT_BIN"
