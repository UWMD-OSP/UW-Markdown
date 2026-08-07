# UW Lite and UWX

UW Markdown supports two complementary Markdown files.

- **`.uw.md` — UW Lite** is a compact, readable deal summary for simple hand authoring, review, and dependable machine extraction through explicit `uw:` field anchors.
- **`.uwx.md` — UWX** is the complete structured underwriting record. It carries the full section model, append-only provenance, detailed assumptions, calc inputs, and the structured editor workflow.

Use Lite when a person needs a lean, familiar-looking underwriting summary. Use UWX as the working record whenever the deal needs full structured underwriting.

## Open either file in the editor

The [reference editor](https://www.uwmd.org/editor/) accepts both files. Opening Lite compiles the supported deal-summary fields into UWX and then uses the normal structured editor. The compilation bar shows the mapped fields and deterministic defaults, while the complete Lite source is retained inside the UWX file as a namespaced provenance extension.

The compiler rejects unsupported units, period-qualified values, non-base scenarios, and unknown fields. It does not infer financial values.

## Exporting back to Lite

Choose **Export Lite** in the editor or run:

```bash
uwmd convert deal.uwx.md --to lite --projection-report deal.lite-projection.json
```

Lite is deliberately a smaller deal-summary profile. If an UWX record contains data outside that profile, the editor shows the number and exact omitted paths before export; the CLI writes the same machine-readable report with `--projection-report`.

That warning is intentional: a Lite export is a readable summary, not a replacement for the complete UWX record. Keep the `.uwx.md` file with the export whenever the projection is lossy.

## Command-line conversion

```bash
# Compile a Lite summary into the complete structured representation
uwmd convert broker-summary.uw.md --to uwx

# Create a readable Lite summary from a UWX record
uwmd convert underwriting.uwx.md --to lite --projection-report lite-loss.json

# Rename a legacy structured .uw.md without changing its bytes
uwmd migrate-source legacy-structured.uw.md
```

A legacy structured `.uw.md` is detected from its fenced UWX content and can be migrated byte-for-byte to `.uwx.md`. Lite files remain `.uw.md`.

## A minimal Lite field

```markdown
- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->
```

The visible text stays easy to read. The anchor provides the stable machine field path, while the parser normalizes the currency value deterministically. See the [UW Lite specification](../spec/UW_LITE_SPEC_v1.md) for the complete grammar and supported bridge profile.