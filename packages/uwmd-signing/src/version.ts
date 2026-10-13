// The package identity, read from this package's own manifest at load time so
// it cannot drift from the published version. `SIGNING_VERSION` said 0.2.0
// through the 0.3.0 release because it was a hand-kept literal. @uwmd/signing is
// Node-only (it needs node:crypto), so unlike core's browser-safe literal it can
// read package.json: `../package.json` resolves from both `src/` and `dist/`.

import { createRequire } from 'node:module';

const manifest = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

export const SIGNING_PACKAGE_NAME = '@uwmd/signing' as const;
export const SIGNING_VERSION: string = manifest.version;
