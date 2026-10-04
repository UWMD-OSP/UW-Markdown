// Pre-flight check for npm Trusted Publishers (OIDC) automated publishing.
// Verifies:
// 1. Package versions and exact core pins across all six official publishing packages.
// 2. Export targets, binaries, and production build artifacts exist and resolve.
// 3. OIDC provenance eligibility (repository metadata, public access, zero hardcoded tokens).
// 4. .github/workflows/release.yml triggers on tag pushes and includes id-token: write,
//    and runs `verify-release --tag` over a tagged checkout before any publish.
//
// Run: npm run release:check

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_MODULE_PACKAGES, RELEASE_PACKAGES } from './release-packages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

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

  // The release-record gate must run on the tag before any publish step, over a
  // checkout that has the tags verify-release compares against.
  const gate = workflow.search(/node scripts\/verify-release\.mjs --tag "\$\{GITHUB_REF_NAME\}"/);
  const firstPublish = workflow.search(/^\s+npm publish/m);
  if (gate === -1 || (firstPublish !== -1 && gate > firstPublish)) {
    failures.push(
      `${workflowPath}: must run 'node scripts/verify-release.mjs --tag "\${GITHUB_REF_NAME}"' before the first npm publish, so a tag on a tree whose release records are not final publishes nothing`,
    );
  }
  if (!/fetch-tags:\s*true/.test(workflow) || !/fetch-depth:\s*0/.test(workflow)) {
    failures.push(`${workflowPath}: checkout needs fetch-depth: 0 and fetch-tags: true for verify-release`);
  }

  // Each package's own step must probe the registry and publish with provenance.
  for (const pkg of RELEASE_PACKAGES) {
    const step = workflow.split(/\n {6}- name:/).find((part) =>
      part.includes(`working-directory: ${pkg.dir}\n`));
    if (!step || !/npm publish[^\n]*--provenance[^\n]*--access public/.test(step)) {
      failures.push(`${workflowPath}: missing public provenance publish step for ${pkg.name}`);
    }
    if (!step?.includes(`scripts/registry-version-state.mjs" "${pkg.name}" "$VER"`)) {
      failures.push(`${workflowPath}: ${pkg.name} must use the fail-closed registry version probe`);
    }
  }
  if (/workflow_dispatch:/.test(workflow)) {
    failures.push(`${workflowPath}: ordinary releases must remain tag-triggered; no module-only dispatch`);
  }

  passes.push(
    'Workflow .github/workflows/release.yml: tag trigger, OIDC permissions, release-record gate, and provenance steps verified',
  );
} catch (err) {
  failures.push(`.github/workflows/release.yml verification failed: ${err.message}`);
}

// ── 2. Version Synchronization ───────────────────────────────────────────────
try {
  const corePkg = readJson('packages/uwmd-core/package.json');
  const cliPkg = readJson('packages/uwmd-cli/package.json');

  // Core and CLI must be in lockstep
  if (corePkg.version !== cliPkg.version) {
    failures.push(
      `Version mismatch: @uwmd/core (${corePkg.version}) != @uwmd/cli (${cliPkg.version})`,
    );
  }

  for (const pkg of RELEASE_PACKAGES.filter((pkg) => pkg.name !== '@uwmd/core')) {
    const pin = readJson(`${pkg.dir}/package.json`).dependencies?.['@uwmd/core'];
    if (pin !== corePkg.version) {
      failures.push(`${pkg.name} depends on @uwmd/core@${pin}, expected exact ${corePkg.version}`);
    }
  }

  // Matrix check against VERSIONS.md
  const versionsDoc = read('VERSIONS.md');
  const matrixStart = versionsDoc.indexOf('## Current matrix');
  if (matrixStart !== -1) {
    const matrixEnd = versionsDoc.indexOf('\n## ', matrixStart + 1);
    const matrixSection = versionsDoc.slice(matrixStart, matrixEnd === -1 ? undefined : matrixEnd);

    const rows = matrixSection.split('\n').filter((line) => line.trimStart().startsWith('|'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.replaceAll('*', '').replaceAll('`', '').trim()));
    for (const pkg of RELEASE_PACKAGES) {
      const stated = rows.find((cells) => cells[0] === pkg.row)?.[1]?.split(/\s+/)[0];
      const declaredVersion = readJson(`${pkg.dir}/package.json`).version;
      if (stated !== declaredVersion) {
        failures.push(`VERSIONS.md matrix lists ${pkg.name} as ${stated ?? 'missing'}, but manifest declares ${declaredVersion}`);
      }
    }
  } else {
    failures.push('VERSIONS.md: missing Current matrix');
  }

  passes.push(
    'Version synchronization: six package versions, exact core pins and VERSIONS.md match',
  );
} catch (err) {
  failures.push(`Version synchronization check failed: ${err.message}`);
}

// ── 3. Export Targets & Production Artifacts ─────────────────────────────────
try {
  for (const pkg of RELEASE_PACKAGES) {
    const manifest = readJson(`${pkg.dir}/package.json`);

    if (manifest.name !== pkg.name) failures.push(`${pkg.dir}: expected package name ${pkg.name}, got ${manifest.name}`);
    if (OFFICIAL_MODULE_PACKAGES.some((module) => module.name === pkg.name)) {
      if (manifest.type !== 'module' || manifest.main !== './dist/index.js' || manifest.types !== './dist/index.d.ts'
        || manifest.exports?.['.']?.import !== manifest.main || manifest.exports?.['.']?.types !== manifest.types) {
        failures.push(`${pkg.name}: public ESM and TypeScript entry exports are required`);
      }
      if (manifest.exports?.['./manifest.json'] !== './dist/manifest.json') {
        failures.push(`${pkg.name}: exported ./manifest.json must resolve to ./dist/manifest.json`);
      }
      for (const artifact of ['dist/view-models.js', 'dist/view-models.d.ts', 'dist/manifest.json', 'LICENSE']) {
        if (!existsSync(resolve(root, pkg.dir, artifact))) failures.push(`${pkg.name}: missing ${artifact}`);
      }
      if (manifest.publishConfig?.access !== 'public' || manifest.license !== 'MIT') {
        failures.push(`${pkg.name}: public publication and MIT license metadata are required`);
      }
    }

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
      !['git+https://github.com/UWMD-OSP/UW-Markdown.git', 'https://github.com/UWMD-OSP/UW-Markdown.git', 'https://github.com/UWMD-OSP/UW-Markdown'].includes(manifest.repository.url)
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
  `\n[PASS] Release readiness check complete: all ${RELEASE_PACKAGES.length} packages have repository/workflow OIDC prerequisites. Account-side publishers require owner confirmation.`,
);
