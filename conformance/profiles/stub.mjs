// A conforming implementation that claims only *some* capabilities.
//
// The profile fixtures need a CLI that is genuinely correct — it delegates every
// real subcommand to the reference implementation — but that *claims* less than
// it can do. Anything less would conflate two failures: "the driver skipped the
// wrong case" and "the implementation got the answer wrong".
//
// Used by conformance/profiles/*/impl.mjs (RFC 0030 §Conformance impact).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_CLI = resolve(HERE, '..', '..', 'packages', 'uwmd-cli', 'bin', 'uwmd.mjs');

/**
 * @param {string[] | null} capabilities  Capabilities to claim. `null` omits the
 *   key entirely, which the driver must read as "claims everything" rather than
 *   "claims nothing" — forgetting to declare has to fail closed.
 */
export function runStub(capabilities) {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (subcommand === 'manifest') {
    const real = spawnSync(process.execPath, [REAL_CLI, 'manifest'], { encoding: 'utf8' });
    if (real.status !== 0) {
      process.stderr.write(real.stderr ?? '');
      process.exit(real.status ?? 1);
    }
    const manifest = JSON.parse(real.stdout);
    manifest.id = 'org.uwmd.profile-stub';
    if (capabilities === null) delete manifest.capabilities;
    else manifest.capabilities = capabilities;
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    process.exit(0);
  }

  // Everything else is the reference implementation, verbatim. The stub narrows
  // what is claimed, never what is computed.
  const real = spawnSync(process.execPath, [REAL_CLI, subcommand, ...rest], { stdio: 'inherit' });
  process.exit(real.status ?? 1);
}
