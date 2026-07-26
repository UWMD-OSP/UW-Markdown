# @uwmd/core

Reference TypeScript implementation of the UW Markdown (`.uw.md`) underwriting standard.

## Install

```sh
npm install @uwmd/core
```

## Basic use

```ts
import { parseUWFile, validateUWFile, render } from '@uwmd/core';

const parsed = parseUWFile(source);
const validation = validateUWFile(parsed);
const summary = render(parsed, { format: 'summary' });
```

Browser-safe exports are available from `@uwmd/core/browser`. The `pdf` and `docx`
core render targets throw `UnsupportedRenderFormatError`; use `@uwmd/report` for
PDF generation.

Specification, examples, and conformance fixtures:
[github.com/jaredmaxey/uw-markdown](https://github.com/jaredmaxey/uw-markdown).

## Machine interchange

UW Document Envelope 1.0 is the shared model behind deterministic UW JSON 1.0,
UW XML 1.0, and normalized UW CSV Bundle 1.0. All three preserve provenance,
prose, extensions, arrays, and superseded history and verify the same semantic
SHA-256 digest.

```ts
import {
  CORE_CODEC_REGISTRY,
  parseUWFile,
  parseUWXmlVerified,
  stringifyUWXml,
  encodeUWCSVZip,
  toUWEnvelope,
} from '@uwmd/core';

const envelope = toUWEnvelope(parseUWFile(markdown));
const xml = await stringifyUWXml(envelope);
const verified = await parseUWXmlVerified(xml);
const csvZip = await encodeUWCSVZip(verified);
const json = await CORE_CODEC_REGISTRY.encode<string>('uw-json', verified);
```

See the [UW XML Mapping 1.0](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/UW_XML_MAPPING_v1.md) and [UW CSV Bundle 1.0](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/UW_CSV_BUNDLE_v1.md) specifications.

## HTTP and MCP bindings

The optional transport helpers preserve the same registry and semantic digest:

```ts
import {
  createUWHTTPResponse,
  createUWMCPGetDocumentResult,
  createUWMCPResource,
} from '@uwmd/core';

const http = await createUWHTTPResponse(envelope, {
  accept: 'application/vnd.uwmd.document+xml',
  ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
});
const toolResult = await createUWMCPGetDocumentResult(envelope, dealId, {
  representation: 'uw-json',
});
const resource = await createUWMCPResource(envelope, dealId, {
  representation: 'uw-json',
});
```

Tool results contain compact `structuredContent` plus JSON text fallback and a
resource link. Complete JSON/XML, CSV views, and binary CSV ZIP bytes are read
through resources. See [HTTP Binding 1.0](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/bindings/UW_HTTP_BINDING_v1.md) and [MCP Binding 1.0](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/bindings/UW_MCP_BINDING_v1.md).