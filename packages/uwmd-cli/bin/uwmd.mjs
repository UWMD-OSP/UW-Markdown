#!/usr/bin/env node
// uwmd — standalone CLI installer for the UW Markdown standard.
//
// This is a thin wrapper that re-exposes the CLI from @uwmd/core so that
// non-developers can run it from npm without cloning the repo:
//
//   npx @uwmd/cli init --output deal.uwx.md   # scaffold a blank .uwx.md file
//   npx @uwmd/cli validate deal.uwx.md        # run the Format validator
//   npx @uwmd/cli verify deal.uwx.md          # validate, integrity, provenance
//   npx @uwmd/cli receipt issue deal.uwx.md   # issue a verification receipt
//
// The package is scoped: run it as `npx @uwmd/cli`, or install it and run
// `uwmd`. The unscoped npm name `uwmd` is not this package.
// All implementation lives in @uwmd/core.

import '@uwmd/core/cli';
