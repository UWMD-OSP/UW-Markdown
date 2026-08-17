#!/usr/bin/env bash
# Vercel "Ignored Build Step" — exit 0 to SKIP, exit 1 to BUILD.
# Configure in Vercel: Project Settings → Build and Deployment → Ignored Build
# Step → Run my Bash script → `bash scripts/vercel-ignore-build.sh`
#
# The deployed docs site is built from @uwmd/core, the web tools, and the
# markdown that prebuild.mjs/prepare-public.mjs copy in. Preview builds for
# commits that touch none of those (CLI/Excel packages, CI config, tests) are
# skipped to save build minutes.

set -euo pipefail

BRANCH="${VERCEL_GIT_COMMIT_REF:-}"

# Always build the production branch.
if [ "$BRANCH" = "main" ]; then
  exit 1
fi

# Paths the site build actually consumes (see vercel.json buildCommand,
# tools/docs-site/scripts/prebuild.mjs, and prepare-public.mjs).
SITE_PATHS=(
  packages/uwmd-core
  tools/docs-site
  tools/web-editor
  tools/web-viewer
  spec
  # docs/wiki is the internal dev wiki and is never published — only these
  # docs/ paths feed the site (prebuild.mjs and prepare-public.mjs).
  ':(glob)docs/*.md'
  docs/releases
  docs/rfcs
  docs/downloads
  docs/site-assets
  conformance
  examples
  vercel.json
  package.json
  package-lock.json
  ':(glob)*.md'
)

# Vercel checks out a shallow clone; if HEAD^ isn't available, build.
if git rev-parse HEAD^ >/dev/null 2>&1; then
  if git diff --quiet HEAD^ HEAD -- "${SITE_PATHS[@]}"; then
    echo "Skipping build — no site-affecting changes since previous commit"
    exit 0
  fi
fi

exit 1
