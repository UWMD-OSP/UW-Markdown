# Changelog

All notable changes to UW Markdown — the format spec, the protocol spec, the
reference library `@uwmd/core`, the conformance corpus, and starter tools — are
documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows semantic versioning per surface (the format, the
protocol, and each package each carry an independent semver).

## [Unreleased]

- Accept RFC 0132: separate physical occupancy from same-period collected-rent economic occupancy, preserve explicit zero, and expose unavailable reasons in rent-roll derivation and the editor.

- Accept RFC 0131: preserve authored statement aggregates, require complete declared detail for computed subtotals, and expose missing prerequisites and whole-dollar disagreements.

### Added

- Proposed RFC 0133: align malformed input-hash diagnostics, pending project-owner acceptance.

- Attributed loan-quote, offering-memorandum and appraisal fact profiles with explicit projection candidates.
- Independent Python Reader and Verifier support, bounded pro-forma assessment, and property and lease-up cash-flow verification.
- Committed-source build identities and a release-pinned synthetic quickstart, checked against published tools and current source.

### Changed

- Align all twelve builtin asset classes with the metric dictionary, declared size and LTV-basis rules, workbook layouts and verification profiles.
- Retain physical block history and provenance across full-record representations; strengthen carrier, archive and source admission.
- Explain receipt coverage and embedded versus detached authentication; distinguish unverifiable receipt outcomes with exit code 3.
- Refresh site navigation, responsive layouts, canonical/social metadata, accessibility and runnable data-lake guidance.

### Fixed

- Verify receipt signatures and results against one detached snapshot, and resolve held inputs through own properties only.
- Apply shared half-away reporting ties and keep commercial income and concentration on the same tenant population.
- Preserve aggregate-only operating income and expenses, including exact authored fractional totals, across editor input edits and reload.

- Exclude generated local Workers middleware from source lint checks (#638).

- Open the hosted editor from the standalone viewer's Lite link, including local-file use (#636).

- Improve light-theme syntax-token contrast in documentation code samples (#634).

- Harden provenance, currency, calendar, cash-flow and receipt checks, with deterministic and independent conformance controls.
- Correct workbook formulas, capital-stack service, mixed-use import and missing-value rendering.
- Repair published sample loading, editor rename/download behavior, viewer keyboard controls and sparse-record summaries and batch exports.
- Package the VS Code extension as a licensed bundled runtime; refresh supported dependency resolutions and verify the produced archive.

## [4.3.0] - 2026-10-15

### Released

The 4.x series established Format 3.0, Protocol 4.1.0 and the reference toolkit's independently versioned packages, including detached document signatures and verification receipts. The [version matrix](VERSIONS.md) records published pairings, and [GitHub Releases](https://github.com/UWMD-OSP/UW-Markdown/releases) records the individual publications. Earlier 4.x entries are consolidated here as prelaunch history.
