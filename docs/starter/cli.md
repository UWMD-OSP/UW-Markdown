# Starter products: CLI reference

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved from the [Format specification](../../spec/UW_FORMAT_SPEC.md)
> Part VI under [RFC 0112](../rfcs/0112-remove-bancroft-vocabulary.md) (D6).
> Section numbers are kept so existing references still find the text. The
> removed `uwmd run` command (§6.3) is not carried over, and §6.8's producer
> obligations moved into the Format as §3.6. The requirement keywords below
> describe how the reference `uwmd` CLI behaves. They are not conformance
> requirements of the standard, and a conforming Reader or Verifier owes none
> of them.

## VI. Toolchain Interface

The `uwmd` command-line tool is the reference implementation. Other tools (AI agents, API consumers, rendering pipelines) implement a subset of this interface. The full command list is `uwmd --help`; the [CLI package README](../../packages/uwmd-cli/README.md) documents every command.

### 6.1 `uwmd parse <file>`

Reads a `.uwx.md` file and outputs a structured JSON object containing:
- Frontmatter (as-is)
- All non-superseded data blocks, keyed by section ID and variant
- Pipeline log entries

```json
{
  "frontmatter": { "...": "YAML frontmatter as JSON" },
  "sections": {
    "property": { "...": "most recent non-superseded block" },
    "operating_statement": {
      "t12": { "...": "t12 variant" },
      "t3": { "...": "t3 variant" }
    }
  },
  "prose": {
    "property": "string — the markdown prose block for this section",
    "...": "..."
  },
  "pipeline_log": [ "...entries..." ]
}
```

### 6.2 `uwmd validate <file> [--json]`

Runs all validation rules (Format Part V) and returns, with `--json`, the
validation result that [Format](../../spec/UW_FORMAT_SPEC.md) §5.6 specifies: `overall_status`, `stage_readiness`, `issues`, `deal_flags`, the
`errors`, `warnings` and `info` partitions, `coverage` and
`replacement_funding_verification`.

Human-readable output lists the deal flags under their own heading after the
validation issues.

The CLI takes no `--stage` flag; read one stage's readiness from
`stage_readiness`.

### 6.4 `uwmd render <file> --format <format> [--tier <tier>]`

Renders the file to an output format. Formats:

| Format | Description | Requires |
|---|---|---|
| `json` | Extracted data only (no prose) | Any stage |
| `csv` | Flat metrics summary | Any stage |
| `chat` | Compressed context for AI assistant | Any stage |
| `summary` | One-page deal summary markdown | Screening+ |

The `--tier screener` flag renders only the Tier 1 sections. The `--tier analyst` flag renders the full package.

`uwmd render` does not produce PDF or Word output. The lender package and
credit memo PDFs ([renderer reference](rendering.md)) come from the separate
`uwmd-report` tool (`@uwmd/report`); no DOCX renderer exists.

### 6.5 `uwmd compact <file>`

Removes all blocks where `_meta.lifecycle.superseded === true`. Preserves the pipeline log. Outputs the compacted file. Appends a `compact` entry to the pipeline log.

### 6.6 `uwmd diff <file_a> <file_b>`

Compares two `.uwx.md` files (or two versions of the same file at different timestamps) and outputs a structured diff showing which sections changed, what values changed, and which source produced the change.

### 6.7 `uwmd init --scenario <scenario> --address <address>`

`--scenario` writes a standard business plan (Format §2.2b) or a well-formed
reverse-DNS extension; omitted means null. It refuses unlisted bare or malformed values before writing. Readers still preserve these values and
warn rather than reject (Format §5.4). `--asset-subtype` writes the open subtype
carrier; for single-site BTR use `--asset-class multifamily --asset-subtype
build_to_rent --scenario stabilized_acquisition` (or the actual plan).
`uwmd init` writes only bare nested Format 3.0 blocks, with `uw_version: "3.0"`; it takes no `--format`. Lite compilation emits the same Format 3.0 contract for all twelve builtin classes. No migrate command is part of the toolchain.

The new file is named with `--output <file>` (default `new-deal.uwx.md`);
`init` takes no file argument and refuses to overwrite an existing file.

Creates a new `.uwx.md` file with:
- Populated frontmatter
- All section headers in canonical order
- Empty data block stubs (all fields null) for each section
- An initial `pipeline_log` entry recording creation
