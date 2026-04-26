#!/usr/bin/env node
// uwmd — standalone CLI installer for the UW Markdown standard.
//
// This is a thin wrapper that re-exposes the CLI from @uwmd/core so that
// non-developers can run:
//
//   npx uwmd init       # scaffold a blank .uw.md file
//   npx uwmd parse      # parse and inspect a deal file
//   npx uwmd validate   # run the full conformance validator
//   npx uwmd render     # render to chat / summary / markdown
//   npx uwmd edit       # apply a Tier-2 EditOperation
//   npx uwmd calc       # evaluate a Tier-3 calc declaration
//   npx uwmd run        # invoke the Tier-4 agent host
//
// All implementation lives in @uwmd/core; this package exists purely so
// people who haven't cloned the repo can `npx uwmd ...` straight from npm.

import '@uwmd/core/cli';
