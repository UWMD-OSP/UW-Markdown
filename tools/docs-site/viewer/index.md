---
title: Reference Web Viewer
description: Open and inspect a UW Markdown underwriting file entirely in your browser.
aside: false
outline: false
---

# Reference Web Viewer

Open a `.uw.md` underwriting file without installing anything. The reference
viewer reads the file locally in your browser and presents its deal summary,
quick metrics, major sections, pipeline state, flags, and supersede history.

<div class="viewer-actions">
  <a class="viewer-action viewer-action--primary" href="https://www.uwmd.org/editor/?sample=/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md" target="_self">Edit this sample</a>
  <a class="viewer-action" href="/viewer/app/?sample=/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md" target="_blank" rel="noopener">Open viewer full screen</a>
  <a class="viewer-action" href="/downloads/programs/uwmd-viewer.html" download="uwmd-viewer.html">Download standalone viewer</a>
  <a class="viewer-action" href="/tutorials/your-first-uwmd-file">How the format works</a>
</div>

::: info Your file stays on your device
Selecting or dropping a file does not upload it. Parsing and rendering happen
inside the browser tab. The sample buttons below load public example files from
this project.
:::

## Try it

Choose a sample or drop your own file into the viewer. Sample links update the
embedded viewer without leaving this page.

<nav class="viewer-samples" aria-label="Example UW Markdown files">
  <a href="/viewer/app/?sample=/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md" target="uwmd-reference-viewer">Multifamily</a>
  <a href="/viewer/app/?sample=/viewer/samples/Riverside-Office-Phoenix-AZ.uwx.md" target="uwmd-reference-viewer">Office</a>
  <a href="/viewer/app/?sample=/viewer/samples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md" target="uwmd-reference-viewer">Retail</a>
  <a href="/viewer/app/?sample=/viewer/samples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md" target="uwmd-reference-viewer">Industrial</a>
  <a href="/viewer/app/?sample=/viewer/samples/Sonoran-Self-Storage-Peoria-AZ.uwx.md" target="uwmd-reference-viewer">Self-storage</a>
  <a href="/viewer/app/?sample=/viewer/samples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md" target="uwmd-reference-viewer">Mixed-use</a>
  <a href="/viewer/app/?sample=/viewer/samples/Agave-Court-Apts-Scottsdale-AZ.uwx.md" target="uwmd-reference-viewer">Capital stack</a>
</nav>

<div class="viewer-frame-shell">
  <div class="viewer-frame-bar">
    <span><i></i><i></i><i></i></span>
    <code>reference-viewer / tier-1</code>
    <a href="/viewer/app/" target="_blank" rel="noopener">Open ↗</a>
  </div>
  <iframe
    class="viewer-frame"
    name="uwmd-reference-viewer"
    title="UW Markdown reference web viewer"
    src="/viewer/app/?sample=/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md"
    sandbox="allow-scripts allow-same-origin allow-downloads"
    loading="eager"
  ></iframe>
</div>

## What this reference viewer covers

<div class="viewer-capabilities">
  <section>
    <strong>Read locally</strong>
    <p>Open a file from disk using drag-and-drop or the file picker. Nothing is sent to a server.</p>
  </section>
  <section>
    <strong>Inspect the deal</strong>
    <p>See frontmatter, quick metrics, common underwriting sections, flags, pipeline state, and prior versions.</p>
  </section>
  <section>
    <strong>Understand Tier 1</strong>
    <p>The viewer is deliberately small and readable. Production software should use <code>@uwmd/core</code>.</p>
  </section>
</div>

The viewer is read-only. To validate, edit, calculate, convert, or export a
document, see the [tools comparison](/guide/tools) and
[protocol conformance tiers](/spec/protocol).
