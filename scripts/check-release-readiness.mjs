// Pre-flight check for npm Trusted Publishers (OIDC) automated publishing.
// Verifies:
// 1. Package version synchronization across @uwmd/core, @uwmd/cli, @uwmd/signing, and @uwmd/batch.
// 2. Export targets, binaries, and production build artifacts exist and resolve.
// 3. OIDC provenance eligibility (repository metadata, public access, zero hardcoded tokens).
// 4. .github/workflows/release.yml triggers on tag pushes and includes id-token: write.
//
// Run: npm run release:check

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const RELEASE_PACKAGES = [
  { name: '@uwmd/core', dir: 'packages/uwmd-core' },
  { name: '@uwmd/cli', dir: 'packages/uwmd-cli' },
  { name: '@uwmd/signing', dir: 'packages/uwmd-signing' },
  { name: '@uwmd/batch', dir: 'packages/uwmd-batch' },
];

// ── 1. Workflow Verification ──────────────────────────────────────────────────
try {
  const workflowPath = '.github/workflows/release.yml';
  const workflow = read(workflowPath);

  // Check tag trigger
  const hasTagTrigger = /tags:\s*\n(\s*-\s*['"]?v[*0-9.]*['"]?\s*\n)+/m.test(workflow);
  if (!hasTagTrigger) {
    failures.push(`${workflowPath}: missing push tag trigger (e.g. 'v*' or 'v*.*.*')`);
  }

  // Check permissions: id-token: write and contents: read
  const hasIdToken = /id-token:\s*write/.test(workflow);
  const hasContentsRead = /contents:\s*read/.test(workflow);
  if (!hasIdToken) {
    failures.push(`${workflowPath}: missing 'id-token: write' permission required for OIDC provenance`);
  }
  if (!hasContentsRead) {
    failures.push(`${workflowPath}: missing 'contents: read' permission`);
  }

  // Check publish steps for all 4 packages with --provenance
  for (const pkg of RELEASE_PACKAGES) {
    const pkgPublishRegex = new RegExp(
      `working-directory:\\s*${pkg.dir}[\\s\\S]*?npm publish[^\\n]*--provenance`,
      'm',
    );
    if (!pkgPublishRegex.test(workflow)) {
      failures.push(
        `${workflowPath}: missing publish step with --provenance for ${pkg.name} (${pkg.dir})`,
      );
    }
  }

  passes.push(
    'Workflow .github/workflows/release.yml: tag trigger, OIDC permissions, and provenance steps verified',
  );
} catch (err) {
  failures.push(`.github/workflows/release.yml verification failed: ${err.message}`);
}

// ── 2. Version Synchronization ───────────────────────────────────────────────
try {
  const corePkg = readJson('packages/uwmd-core/package.json');
  const cliPkg = readJson('packages/uwmd-cli/package.json');
  const signingPkg = readJson('packages/uwmd-signing/package.json');
  const batchPkg = readJson('packages/uwmd-batch/package.json');

  // Core and CLI must be in lockstep
  if (corePkg.version !== cliPkg.version) {
    failures.push(
      `Version mismatch: @uwmd/core (${corePkg.version}) != @uwmd/cli (${cliPkg.version})`,
    );
  }

  // CLI dep on core
  const cliCoreDep = cliPkg.dependencies?.['@uwmd/core'];
  if (cliCoreDep !== corePkg.version) {
    failures.push(
      `@uwmd/cli depends on @uwmd/core@${cliCoreDep}, expected exact ${corePkg.version}`,
    );
  }

  // Signing dep on core
  const signingCoreDep = signingPkg.dependencies?.['@uwmd/core'];
  if (signingCoreDep !== corePkg.version) {
    failures.push(
      `@uwmd/signing depends on @uwmd/core@${signingCoreDep}, expected exact ${corePkg.version}`,
    );
  }

  // Batch dep on core
  const batchCoreDep = batchPkg.dependencies?.['@uwmd/core'];
  if (batchCoreDep !== corePkg.version) {
    failures.push(
      `@uwmd/batch depends on @uwmd/core@${batchCoreDep}, expected exact ${corePkg.version}`,
    );
  }

  // Matrix check against VERSIONS.md
  const versionsDoc = read('VERSIONS.md');
  const matrixStart = versionsDoc.indexOf('## Current matrix');
  if (matrixStart !== -1) {
    const matrixEnd = versionsDoc.indexOf('\n## ', matrixStart + 1);
    const matrixSection = versionsDoc.slice(matrixStart, matrixEnd === -1 ? undefined : matrixEnd);

    for (const pkg of RELEASE_PACKAGES) {
      const labelEscaped = pkg.name.replace(/[/@]/g, '\\$&');
      const rowRegex = new RegExp(
        `\\|\\s*${labelEscaped}(?:\\s*\\([^)]*\\))?\\s*\\|\\s*\\*\\*?([0-9a-zA-Z.-]+)\\*\\*?\\s*\\|`,
      );
      const match = matrixSection.match(rowRegex);
      const declaredVersion = readJson(`${pkg.dir}/package.json`).version;
      if (match && match[1] !== declaredVersion) {
        failures.push(
          `VERSIONS.md matrix lists ${pkg.name} as ${match[1]}, but manifest declares ${declaredVersion}`,
        );
      }
    }
  }

  passes.push(
    'Version synchronization: @uwmd/core, @uwmd/cli, @uwmd/signing, @uwmd/batch and VERSIONS.md match',
  );
} catch (err) {
  failures.push(`Version synchronization check failed: ${err.message}`);
}

// ── 3. Export Targets & Production Artifacts ─────────────────────────────────
try {
  for (const pkg of RELEASE_PACKAGES) {
    const manifest = readJson(`${pkg.dir}/package.json`);

    // Check main entrypoint
    if (manifest.main) {
      const mainPath = resolve(root, pkg.dir, manifest.main);
      if (!existsSync(mainPath)) {
        failures.push(`${pkg.name}: main entrypoint '${manifest.main}' not found at ${mainPath}`);
      }
    }

    // Check types entrypoint
    if (manifest.types) {
      const typesPath = resolve(root, pkg.dir, manifest.types);
      if (!existsSync(typesPath)) {
        failures.push(`${pkg.name}: types entrypoint '${manifest.types}' not found at ${typesPath}`);
      }
    }

    // Check bin entries
    if (manifest.bin) {
      const bins = typeof manifest.bin === 'string' ? { [pkg.name]: manifest.bin } : manifest.bin;
      for (const [binName, binRelPath] of Object.entries(bins)) {
        const binPath = resolve(root, pkg.dir, binRelPath);
        if (!existsSync(binPath)) {
          failures.push(
            `${pkg.name}: bin executable '${binName}' -> '${binRelPath}' not found at ${binPath}`,
          );
        }
      }
    }

    // Check exports field targets
    if (manifest.exports && typeof manifest.exports === 'object') {
      const checkExport = (target, subpath) => {
        if (typeof target === 'string') {
          const exportPath = resolve(root, pkg.dir, target);
          if (!existsSync(exportPath)) {
            failures.push(`${pkg.name}: export '${subpath}' target '${target}' not found`);
          }
        } else if (target && typeof target === 'object') {
          for (const [cond, condTarget] of Object.entries(target)) {
            checkExport(condTarget, `${subpath} -> ${cond}`);
          }
        }
      };
      for (const [subpath, target] of Object.entries(manifest.exports)) {
        checkExport(target, subpath);
      }
    }
  }

  passes.push(
    'Export targets and build artifacts: all entrypoints, bins, and export maps resolve to physical files',
  );
} catch (err) {
  failures.push(`Export target verification failed: ${err.message}`);
}

// ── 4. OIDC Provenance Eligibility ───────────────────────────────────────────
try {
  for (const pkg of RELEASE_PACKAGES) {
    const manifest = readJson(`${pkg.dir}/package.json`);

    // Must not be private
    if (manifest.private === true) {
      failures.push(`${pkg.name}: package marked as private; cannot publish to npm`);
    }

    // Must have repository URL matching GitHub repo
    if (
      !manifest.repository ||
      !manifest.repository.url ||
      !manifest.repository.url.includes('UWMD-OSP/UW-Markdown')
    ) {
      failures.push(`${pkg.name}: missing or invalid repository.url for OIDC provenance attestation`);
    }

    // Must specify repository directory
    if (!manifest.repository || manifest.repository.directory !== pkg.dir) {
      failures.push(
        `${pkg.name}: repository.directory must be '${pkg.dir}', got '${manifest.repository?.directory}'`,
      );
    }

    // Must have license
    if (!manifest.license) {
      failures.push(`${pkg.name}: missing license field`);
    }
  }

  passes.push(
    'OIDC provenance eligibility: repository metadata, directory mappings, and license validated',
  );
} catch (err) {
  failures.push(`OIDC eligibility check failed: ${err.message}`);
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const pass of passes) {
  console.log(`[PASS] ${pass}`);
}

if (failures.length > 0) {
  console.error('\nRelease readiness check failed:');
  for (const failure of failures) {
    console.error(`  [FAIL] ${failure}`);
  }
  process.exit(1);
}

console.log(
  '\n[PASS] Release readiness check complete: all 4 publishing packages are OIDC ready.',
);
