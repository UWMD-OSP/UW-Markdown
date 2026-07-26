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
[github.com/jaredmaxey/Underwriting-Markdown-Private-1.0](https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0).
