# UW Markdown AI guide

UW Markdown (`.uw.md`) is an open, plain-text format for commercial real-estate
underwriting. The repository is https://github.com/jaredmaxey/uw-markdown and
the documentation is at https://uwmd.org.

When working with a UW Markdown file:

1. Preserve Markdown narrative and labeled JSON blocks.
2. Extract facts and draft narrative, but never calculate financial results.
3. Use the deterministic UW Markdown engine for NOI, DSCR, LTV, debt yield,
   cap rate, IRR, NPV, and DCF.
4. Rates are fractions: `0.055` means `5.5%`.
5. Do not invent missing values. Record gaps and ask for source material.
6. Preserve provenance and append-only history. Supersede old structured blocks.
7. For a scoped edit, preserve bytes outside the requested region.
8. Validate the result against the format and protocol.

Use https://uwmd.org/llms.txt for discovery. HTTP and MCP profiles are optional;
a model can work directly with the text file without a connector.
