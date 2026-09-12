# Documentation and docs-build reconciliation

Status: completed · 2026-09-11 · Baseline: `9f243e1` (core/CLI 2.6.2)

## Scope

Verify the reported historical contradictions against current source and tags.
Correct current-facing version/status prose, preserve historical release records,
and archive the completed [Protocol 1.3 contract](protocol-1.3-hardening.md).
Derive site version labels from source and discover `docs/rfcs/*.md` dynamically,
preserving index/template URLs, link rewriting, and RFC status banners. Update
the index verifier and exercise automatic discovery of a future RFC.

Clarify mixed-use aggregation versus speculative leasing, and boundary quantization
versus rate/balance precision. RFC 0041 stays draft; no native `bps` policy,
financial formula, normative spec, schema, exported core type, dependency, or
publication change is authorized by this editorial maintenance task.

## Definition of done

The requested claims have an evidence-backed disposition; the corrected site
builds without dead links; repository verification gates pass. See [task matrix](docs-site-reconciliation-tasks.md).
