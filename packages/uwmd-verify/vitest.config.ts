import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Match the root run, including standalone coverage on a busy machine.
    pool: 'forks',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // Coverage floor — a ratchet, not a target, with @uwmd/core's policy
      // (see its vitest.config.ts): just under measured coverage, because the
      // seeded property tests still leave ~0.2 points of run-to-run jitter, and
      // raised when coverage rises durably. Lowering one is a deliberate act
      // that belongs in a PR description. Measured 2026-10-13 when the package
      // was created (RFC 0083 Phase 2): 94.65% lines and statements, 86.97%
      // branches, 99% functions.
      thresholds: {
        lines: 93,
        statements: 93,
        functions: 98,
        branches: 86,
      },
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.property.test.ts',
        'src/**/*.d.ts',
        // Re-export barrels: `export {}` lists with nothing a test could
        // exercise. The build, `browser.test.ts` and `verify-packages` hold the
        // public surface instead (the same exclusion @uwmd/core makes).
        'src/index.ts',
        'src/browser.ts',
      ],
    },
  },
});
