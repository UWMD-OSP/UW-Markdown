#!/usr/bin/env node
// uwmd-excel — convert a .uw.md file to a multifamily underwriting workbook.
//
// Thin shim that delegates to the compiled CLI in dist/. The real argv parsing,
// parse → convert → write pipeline, and exit-code handling live in src/cli.ts.

import '../dist/cli.js';
