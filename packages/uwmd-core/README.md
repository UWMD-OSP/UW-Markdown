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

UW Document Envelope 1.0 is the shared model behind deterministic UW JSON 1.0
and UW XML 1.0. Both codecs preserve provenance, prose, extensions, arrays, and
superseded history and verify the same semantic SHA-256 digest.

```ts
import {
  CORE_CODEC_REGISTRY,
  parseUWFile,
  parseUWXmlVerified,
  stringifyUWXml,
  toUWEnvelope,
} from '@uwmd/core';

const envelope = toUWEnvelope(parseUWFile(markdown));
const xml = await stringifyUWXml(envelope);
const verified = await parseUWXmlVerified(xml);
const json = await CORE_CODEC_REGISTRY.encode<string>('uw-json', verified);
```

See the [UW XML Mapping 1.0](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/UW_XML_MAPPING_v1.md) for the normative mapping and parser limits.
