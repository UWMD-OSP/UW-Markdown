import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // Coverage floor — a ratchet, not a target.
      //
      // These sit just under measured coverage (2026-08-13: ~77.0% lines and
      // statements, ~75.5% branches, 96.74% functions). The `coverage` job in
      // .github/workflows/ci.yml runs this and has no `continue-on-error`, so
      // falling through a floor fails CI.
      //
      // The margin is not decoration. `calc/calc.property.test.ts` drives
      // fast-check with no fixed seed, so each run explores different inputs and
      // exercises different branches: three consecutive local runs measured
      // 77.01 / 77.00 / 76.98 statements and 75.61 / 75.47 / 75.40 branches.
      // Coverage here is nondeterministic by design, so a floor set flush
      // against a measured figure would fail at random. ~1 point absorbs the
      // observed ~0.2-point jitter with room to spare.
      //
      // Policy: when coverage rises durably, raise these. Lowering one is a
      // deliberate act that belongs in a PR description, not a quiet edit.
      // Ratcheted 2026-08-13 (T9): the provider seam made agents/ testable, so
      // measured coverage moved 76.98% -> 80.05% lines/statements and
      // 75.4% -> 76.47% branches. Raising the floor with it is the policy above.
      thresholds: {
        lines: 79,
        statements: 79,
        functions: 96,
        branches: 75,
      },
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.property.test.ts',
        'src/**/*.d.ts',
      ],
    },
  },
});
