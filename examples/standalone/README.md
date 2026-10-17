# Standalone UW document kit

Use the [current positive kit](authored-2026-10-17/README.md) for profiles,
fragments, composition and deal-package examples. It has explicit authored
review/lifecycle declarations and tests complete resolved models, digests,
package integrity and source-context boundaries.

The2026-10-17 owner rule retires prelaunch preservation, migration and repair
work. Existing examples are ordinary development inputs; their historical
bytes and verdicts are not compatibility gates. Current verification tests
continue to enforce the accepted contracts.

```text
npm run build
node packages/uwmd-cli/bin/uwmd.mjs package verify examples/standalone/authored-2026-10-17/package/standalone-authored.uwpkg.zip
```

Package verification checks member/semantic identity, not financial truth or
source authenticity. The source text is fictional illustrative data.
