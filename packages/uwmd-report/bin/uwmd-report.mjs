#!/usr/bin/env node
// uwmd-report — render a .uw.md file to a lender package / credit memo PDF.
//
// Thin shim that delegates to the compiled CLI in dist/. The real argv parsing,
// parse → render → print pipeline, and exit-code handling live in src/cli.ts.

import '../dist/cli.js';
