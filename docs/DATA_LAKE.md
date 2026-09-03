# UW Markdown → data lake

UW Markdown is the backbone of a CRE data lake, not the lake itself. The
standard contributes the three things a lake cannot retrofit later —
**canonical facts** (one deterministic JSON shape per deal, whatever the
authoring surface), **stable identity** (a semantic digest that survives
re-encoding), and **verifiable trust** (receipts that attest outputs follow
from inputs) — and stays out of everything a lake vendor already does well
(storage, orchestration, query engines).

This guide shows the full pipeline with nothing but the published `uwmd` CLI
and DuckDB. Every command and query below was run before it was written down.
The same CSVs load into Snowflake, ClickHouse, BigQuery, or Pandas unchanged —
DuckDB is just the shortest path to a working demo.

## 1. From deals to bundles

Each `.uwx.md` (or `.uw.md` Lite) deal converts to a **UW CSV bundle**
([`UW_CSV_BUNDLE_v1.md`](../spec/UW_CSV_BUNDLE_v1.md)) — a deterministic ZIP
of typed CSV files plus a manifest:

```bash
npx @uwmd/cli convert deal.uwx.md --to uw-csv-bundle --output lake/deal-001/deal.uw.csv.zip
```

Extracted, every bundle has the same layout:

```
deal-001/bundle/
├── manifest.json            # versions, semantic digest, file inventory, view descriptors
├── frontmatter.csv          # deal-level fields as typed value rows
├── blocks.csv               # section inventory
├── block_values.csv         # ★ one row per JSON fact — the fact table
├── prose.csv                # narrative text
├── document.csv             # document-level structure
└── views/                   # wide, spreadsheet-shaped projections (lossy, fidelity: "view")
    ├── deal_summary.csv
    ├── operating_statement.csv
    └── …                    # rent_roll, debt, valuation, sources_uses when those sections exist
```

Two different fidelities, on purpose:

- **`block_values.csv` is lossless.** Columns `block_ref`, `scope`, `pointer`,
  `json_type`, `value_json`: one row per fact, JSON Pointer addressing,
  canonical JSON values. Empty containers, nulls vs. absence, array order, and
  unsafe keys all survive. `scope` separates `content` from `_meta` provenance
  and block annotations. (`block_ref` is local to the encoding — use the deal's
  digest plus the pointer as the durable key, never `block_ref` alone.)
- **The `views/` files are lossy conveniences** — deliberately flat for
  spreadsheet users and quick joins. They declare `fidelity: "view"` in the
  manifest and are never reconstruction inputs.

## 2. Querying the lake

Point DuckDB at a directory of extracted bundles. Three query layers fall out
of the layout.

**The catalog** — one row per deal from the `deal_summary` view:

```sql
SELECT deal_id, asset_class, deal_stage, city
FROM read_csv('lake/*/bundle/views/deal_summary.csv',
              union_by_name = true, filename = true);
```

`union_by_name` matters: views may gain columns across format versions, and
deals authored at different versions coexist in one lake.

**The facts** — every stated NOI-model number across every deal:

```sql
SELECT regexp_extract(replace(filename, chr(92), '/'), '([^/]+)/bundle', 1) AS deal,
       pointer, value_json
FROM read_csv('lake/*/bundle/block_values.csv',
              union_by_name = true, filename = true)
WHERE block_ref = '/sections/noi_model'
  AND scope = 'content'
  AND json_type = 'number';
```

(The `replace(filename, chr(92), '/')` keeps the deal-name extraction portable
across Windows and POSIX paths.)

Rates are **fractions, not percents** (`0.0551` = 5.51%) everywhere in UW
Markdown — apply display formatting in the BI layer, not in ingestion.

**The identity** — semantic digests from the manifests:

```sql
SELECT regexp_extract(replace(filename, chr(92), '/'), '([^/]+)/bundle', 1) AS deal,
       semantic_digest
FROM read_json('lake/*/bundle/manifest.json', filename = true);
```

The digest is computed over the canonical envelope, so it is the natural
idempotency key for ingestion: re-encoding an unchanged deal produces a
byte-identical bundle with the same digest, and your loader can skip it. A
changed digest means the deal's semantic content actually changed.

## 3. Joining in trust

A lake of numbers is only as good as its provenance. Issue a receipt per deal:

```bash
npx @uwmd/cli receipt issue deal.uwx.md --output lake/deal-001/deal.receipt.json
```

A receipt ([`UW_RECEIPT_v1.md`](../spec/UW_RECEIPT_v1.md)) attests that the
deal's computed outputs follow from its stated inputs under a named calc pack —
it does **not** attest that the inputs are true. Its `subject.digest` is the
same semantic digest the bundle manifest carries, which makes the trust join
one equality:

```sql
SELECT s.deal_id,
       r.subject.digest = m.semantic_digest AS receipt_matches_bundle,
       r.policy.validation.errors           AS validation_errors,
       r.computation.pack                   AS pack
FROM read_json('lake/deal-001/deal.receipt.json')       r,
     read_json('lake/deal-001/bundle/manifest.json')    m,
     read_csv('lake/deal-001/bundle/views/deal_summary.csv') s;
```

Now every row in the lake traces to a digest, and every digest to a receipt
with a validation verdict and a named, versioned calc pack. That chain — not
the CSV files — is what distinguishes this from generic ETL: two independent
implementations of the standard produce the same digests and the same
computed outputs, so the lake's numbers are reproducible claims, not
spreadsheet exhaust.

## 4. Scaling up

The loop over deals is deliberately boring — any orchestrator can run
`uwmd convert` and `uwmd receipt issue` per file. For the whole-corpus case,
`@uwmd/batch` (unpublished; run from a checkout) walks a directory, validates
every deal, and emits both a deal-level catalog (`uwmd-collection.json` + CSV,
with semantic digests) and — with `--facts` — the corpus fact table directly:

```bash
npx uwmd-batch deals --out lake-out --facts
```

`lake-out/uwmd-facts.jsonl` is one line per JSON fact per deal: the same
normative `block_values` rows as §2's fact table, prefixed with `path`,
`deal_id`, `asset_class`, `semantic_digest`, and the validation verdict — so
the DuckDB side collapses to:

```sql
SELECT deal_id, pointer, value_json
FROM read_json('lake-out/uwmd-facts.jsonl')
WHERE block_ref = '/sections/noi_model' AND scope = 'content'
  AND pointer = '/net_operating_income' AND valid;
```

Files that cannot produce an envelope are listed in
`uwmd-facts-manifest.json` under `deals_skipped`; deals that parse but fail
validation stay in the table with `valid: false`. A fact table never silently
drops a deal.

What the standard will **not** grow: a storage contract, warehouse-specific
loaders, or aggregate-math semantics in the lake layer. Aggregates that need
to be *verifiable* belong in the document layer (portfolio rollups, RFC 0021
§6; portfolio sidecars, protocol §XV) where a verifier can recompute them —
what lands in your warehouse is a projection, and projections are the host's
domain.
