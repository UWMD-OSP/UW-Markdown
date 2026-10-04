<script setup>
import versions from '../../about/versions.json';
import AiBoundary from './AiBoundary.vue';

const PARKVIEW = 'Parkview-Apts-Glendale-AZ.uwx.md';
</script>

<template>
  <main class="uw-home">
    <section class="uw-hero" aria-labelledby="uw-home-title">
      <div class="uw-hero-copy">
        <div class="uw-kicker"><span class="uw-file-mark" aria-hidden="true">UW</span> Open standard for commercial real-estate underwriting</div>
        <h1 id="uw-home-title">One verifiable underwriting record for every CRE deal.</h1>
        <p class="uw-intro">UW Markdown is an open interoperability standard for underwriting. A <code>.uwx.md</code> record keeps typed deal facts, underwriting assumptions, calculation inputs, narrative, and provenance together in one plain-text file. Excel models, AI agents, underwriting applications, and data pipelines can all work from the same deal record.</p>
        <p class="uw-boundary"><span>AI can extract, classify, and explain.</span> <span>Deterministic code calculates and verifies the financial results.</span></p>
        <nav class="uw-actions" aria-label="Get started">
          <a class="uw-button uw-button-primary" href="#example">See a deal record</a>
          <a class="uw-button" href="/tutorials/quickstart">Create and validate a file</a>
          <a class="uw-text-link" href="https://github.com/UWMD-OSP/UW-Markdown">Source on GitHub <span aria-hidden="true">→</span></a>
        </nav>
      </div>

      <aside class="uw-release-card" aria-label="Version summary">
        <div class="uw-panel-bar">
          <span>VERSIONS</span>
          <span class="uw-status uw-status-valid">MIT</span>
        </div>
        <h3 class="uw-card-group">Source tree</h3>
        <dl>
          <div><dt>Format</dt><dd><code>v{{ versions.format }}</code></dd></div>
          <div><dt>Protocol</dt><dd><code>v{{ versions.protocol }}</code></dd></div>
          <div><dt>Core library + CLI</dt><dd><code>v{{ versions.core }}</code></dd></div>
        </dl>
        <h3 class="uw-card-group">Latest published release</h3>
        <dl>
          <div><dt>Generation</dt><dd><code>v{{ versions.published }}</code></dd></div>
        </dl>
        <p>On npm: <span v-for="(name, i) in versions.npm" :key="name"><code>{{ name }}</code><template v-if="i < versions.npm.length - 1"> · </template></span>. Other packages build from source.</p>
        <p v-if="versions.unpublishedSource" class="uw-card-note">Core v{{ versions.core }} is prepared in source and not yet published.</p>
        <a href="/about/versions">Version matrix</a>
      </aside>
    </section>

    <div class="uw-trust-strip" aria-label="What one record carries">
      <span><strong>RENT ROLL</strong> units + leases</span>
      <span><strong>T-12</strong> operating statement</span>
      <span><strong>ASSUMPTIONS</strong> market + underwritten</span>
      <span><strong>DEBT</strong> terms + sizing</span>
      <span><strong>CASH FLOWS</strong> + returns</span>
      <span><strong>NARRATIVE</strong> credit story</span>
      <span><strong>PROVENANCE</strong> who, what, when</span>
    </div>

    <section id="example" class="uw-section uw-example" aria-labelledby="example-title">
      <header class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">Show me a deal</p>
          <h2 id="example-title">A plain-text record, and the underwriting it produces.</h2>
          <p class="uw-section-lede">An excerpt from a 48-unit multifamily acquisition. The narrative explains the analyst's adjustments; the JSON block beneath it holds the same numbers in typed form, so any compatible tool can read and recompute them.</p>
        </div>
        <a :href="`https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples/${PARKVIEW}`">Open the complete record <span aria-hidden="true">→</span></a>
      </header>

      <div class="uw-file-window">
        <div class="uw-file-header">
          <span class="uw-file-name"><span class="uw-file-mini" aria-hidden="true">UW</span> {{ PARKVIEW }}</span>
          <span class="uw-file-state"><span class="uw-status uw-status-valid">VALID</span><span class="uw-status uw-status-info">METRICS RECOMPUTED</span></span>
        </div>
        <div class="uw-file-views">
          <section class="uw-source" aria-labelledby="source-title">
            <div class="uw-subhead"><h3 id="source-title">The record</h3><span>plain text · excerpt</span></div>
            <pre tabindex="0"><code><span class="tok-rule">---</span>
<span class="tok-key">uw_version:</span> <span class="tok-string">"1.1"</span>
<span class="tok-key">deal_name:</span> <span class="tok-string">"Parkview Apartments — Glendale, AZ"</span>
<span class="tok-key">asset_class:</span> <span class="tok-string">"multifamily"</span>
<span class="tok-key">quick_metrics:</span>
  <span class="tok-key">purchase_price:</span>   <span class="tok-number">7200000</span>
  <span class="tok-key">noi_underwritten:</span> <span class="tok-number">396635</span>
  <span class="tok-key">dscr:</span>             <span class="tok-number">1.109</span>
  <span class="tok-key">ltv:</span>              <span class="tok-number">0.70</span>
<span class="tok-key">source_documents:</span>
  - <span class="tok-string">"parkview_rent_roll_apr2026.xlsx"</span>
  - <span class="tok-string">"parkview_t12_2025.pdf"</span>
<span class="tok-rule">---</span>

<span class="tok-heading">## Underwritten NOI</span>

Vacancy is normalized to 7% against the
owner's reported 5%. The management fee
drops from 10% to 5.5% of EGI under the
new agreement. Taxes are reassessed to
the post-sale value.

<span class="tok-code">```json uw:section=noi_model</span>
{
  <span class="tok-json">"_meta"</span>: { <span class="tok-json">"actor"</span>: <span class="tok-string">"system"</span>, <span class="tok-tail">…</span> },
  <span class="tok-json">"income"</span>: {
    <span class="tok-json">"vacancy_credit_loss"</span>: {
      <span class="tok-json">"value"</span>: <span class="tok-number">45864</span>, <span class="tok-json">"rate_applied"</span>: <span class="tok-number">0.07</span>
    },
    <span class="tok-json">"effective_gross_income"</span>: <span class="tok-number">630936</span>
  },
  <span class="tok-json">"expenses"</span>: { <span class="tok-json">"total_operating_expenses"</span>: <span class="tok-number">234301</span> },
  <span class="tok-json">"net_operating_income"</span>: <span class="tok-number">396635</span>
}
<span class="tok-code">```</span></code></pre>
          </section>

          <section class="uw-render" aria-labelledby="render-title">
            <div class="uw-subhead"><h3 id="render-title">What a compatible tool shows</h3><span>underwriting view</span></div>
            <div class="uw-deal-heading">
              <p>Parkview Apartments</p>
              <span>48 units · 1987 vintage · Glendale, Arizona</span>
            </div>
            <div class="uw-metrics">
              <div><span>Purchase price</span><strong>$7,200,000</strong></div>
              <div><span>UW NOI</span><strong>$396,635</strong></div>
              <div><span>DSCR</span><strong>1.109×</strong></div>
              <div><span>LTV</span><strong>70.0%</strong></div>
            </div>
            <div class="uw-table-wrap">
              <table>
                <caption class="uw-visually-hidden">Parkview Apartments operating statement, T-12 actuals against underwritten figures</caption>
                <thead><tr><th scope="col">Operating statement</th><th scope="col">T-12</th><th scope="col">UW</th></tr></thead>
                <tbody>
                  <tr><td>Gross potential rent</td><td>$655,200</td><td>$655,200</td></tr>
                  <tr><td>Vacancy / credit loss</td><td>($32,760)</td><td>($45,864)</td></tr>
                  <tr><td>Other income</td><td>$18,000</td><td>$21,600</td></tr>
                  <tr><td>Effective gross income</td><td>$640,440</td><td>$630,936</td></tr>
                  <tr><td>Total operating expenses</td><td>($228,344)</td><td>($234,301)</td></tr>
                  <tr class="uw-total"><td>Net operating income</td><td>$412,096</td><td>$396,635</td></tr>
                </tbody>
              </table>
            </div>
            <div class="uw-check"><span aria-hidden="true">✓</span><p><strong>DSCR and LTV recomputed by the multifamily calculation pack</strong><br>The pack derives DSCR, LTV, cap rate, and debt yield from figures stated in the record, using deterministic code rather than a model. The operating statement is stated, and validator cross-checks test it for consistency. The DSCR of 1.109× is below the 1.20× warning threshold, so the validator reports a warning.</p></div>
          </section>
        </div>
        <div class="uw-file-footer">
          <span>Authored at format 1.1 · current tools read it unchanged</span>
          <span class="uw-file-links">
            <a href="/viewer/">Open in the viewer</a>
            <a :href="`https://www.uwmd.org/editor/?sample=/viewer/samples/${PARKVIEW}`" target="_self">Edit it in the reference editor</a>
          </span>
        </div>
      </div>
    </section>

    <section class="uw-section" aria-labelledby="record-title">
      <div class="uw-section-heading uw-section-heading-narrow">
        <div>
          <p class="uw-eyebrow">What the record holds</p>
          <h2 id="record-title">The underwriting you already do, written down in a form software can check.</h2>
        </div>
      </div>
      <div class="uw-record-grid">
        <article>
          <h3>Deal facts</h3>
          <p>Property, ownership, rent roll, and the T-12 operating statement as extracted from source documents.</p>
          <code>property · rent_roll · operating_statement</code>
        </article>
        <article>
          <h3>Underwriting assumptions</h3>
          <p>Market and underwritten vacancy, expenses, growth, and cap rates, with the analyst's rationale beside each one.</p>
          <code>noi_model · assumptions · market_analysis</code>
        </article>
        <article>
          <h3>Debt and capital</h3>
          <p>Loan terms, sizing constraints, and capital stacks: the inputs behind DSCR, debt yield, and LTV.</p>
          <code>debt_structure · preliminary_sizing · capital_stack</code>
        </article>
        <article>
          <h3>Cash flows and returns</h3>
          <p>Projected and dated cash flows, lease-up schedules, and distribution waterfalls behind IRR and equity returns.</p>
          <code>dcf · lease_up_schedule · distribution_waterfall</code>
        </article>
        <article>
          <h3>Credit narrative</h3>
          <p>Ordinary Markdown for the story a credit committee reads: thesis, risks, mitigants, and open questions.</p>
          <code>Markdown prose · risk_assessment</code>
        </article>
        <article>
          <h3>Provenance</h3>
          <p>Each block records who or what wrote it, when, from which source, and how confident they were. Revisions supersede earlier blocks instead of erasing them.</p>
          <code>_meta · append-only revisions</code>
        </article>
      </div>
      <p class="uw-grid-note">Each JSON block is a typed section with a published schema. Validators, calculation packs, converters, and conformance fixtures all work against those same sections. See <a href="/guide/lite-and-uwx">UWX and UW Lite</a> for the compact <code>.uw.md</code> summary representation.</p>
    </section>

    <section class="uw-section" aria-labelledby="flow-title">
      <div class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">AI never does the financial math</p>
          <h2 id="flow-title">Models read documents. Code does the arithmetic.</h2>
          <p class="uw-section-lede">The record sits between judgment and computation. Anything that interprets a document can write facts and narrative into it. Only deterministic code turns those facts into NOI, DSCR, or IRR.</p>
        </div>
        <a href="/ai/">Building with AI <span aria-hidden="true">→</span></a>
      </div>
      <AiBoundary />
    </section>

    <section class="uw-section" aria-labelledby="capabilities-title">
      <div class="uw-section-heading uw-section-heading-narrow">
        <div>
          <p class="uw-eyebrow">Design commitments</p>
          <h2 id="capabilities-title">Why a shared record is worth trusting.</h2>
        </div>
      </div>
      <div class="uw-capability-grid uw-capability-grid-3">
        <article>
          <span class="uw-index">01</span>
          <h3>Deterministic calculation</h3>
          <p>Financial outputs covered by a registered calculation pack or verifier are recomputed rather than accepted because an AI or upstream system stated them. Values outside that coverage remain stated facts in the record. The protocol fixes rounding, so any conforming implementation produces the same quantized values. Where the Excel export covers a metric, the workbook formulas match those values exactly.</p>
          <a href="/guide/calc-conventions">Calculation conventions</a>
        </article>
        <article>
          <span class="uw-index">02</span>
          <h3>Portable across tools</h3>
          <p>The same record converts to UW JSON, UW XML, and a CSV bundle, each with a semantic digest. The CLI and core library ship on npm. A batch indexer flattens a folder of deals into a fact table for DuckDB or a warehouse. The Excel workbook exporter and the PostgreSQL lake adapter are open source but not yet published packages.</p>
          <a href="/guide/tools">Tools and packages</a>
        </article>
        <article>
          <span class="uw-index">03</span>
          <h3>Verifiable provenance</h3>
          <p>Edits supersede earlier blocks rather than overwriting them, so the history stays in the file. When you issue a verification receipt, it records that the stated metrics follow from the record under a named pack, and anyone can recompute it offline. Receipts are issued on request, not after every edit. Signing blocks and receipts is a separate, optional capability.</p>
          <a href="/guide/receipts">Verification receipts</a>
        </article>
      </div>
    </section>

    <section class="uw-section uw-try" aria-labelledby="try-title">
      <div class="uw-try-copy">
        <p class="uw-eyebrow">Try it</p>
        <h2 id="try-title">Create and validate a record in two commands.</h2>
        <p class="uw-section-lede">The published CLI runs with Node.js 18 or later. Nothing to clone, no account.</p>
        <nav class="uw-actions" aria-label="Try UW Markdown">
          <a class="uw-button uw-button-primary" href="/tutorials/quickstart">Quickstart</a>
          <a class="uw-button" href="https://www.uwmd.org/editor/" target="_self">Reference editor</a>
          <a class="uw-text-link" href="/downloads/">Templates and examples <span aria-hidden="true">→</span></a>
        </nav>
      </div>
      <div class="uw-terminal" role="group" aria-label="Quickstart commands">
        <div class="uw-panel-bar"><span>TERMINAL</span><span>@uwmd/cli</span></div>
        <pre tabindex="0"><code><span class="tok-rule">$</span> npx @uwmd/cli init --output deal.uwx.md
<span class="tok-tail">Created: deal.uwx.md</span>

<span class="tok-rule">$</span> npx @uwmd/cli validate deal.uwx.md
<span class="tok-tail">Stage Readiness:</span>
<span class="tok-tail">  ✓  screening</span>
<span class="tok-tail">Issues (1):</span>
<span class="tok-tail">  [WARN] CC-13: the property section does not</span>
<span class="tok-tail">  state multifamily's primary size field …</span></code></pre>
      </div>
    </section>

    <section class="uw-section uw-ecosystem" aria-labelledby="ecosystem-title">
      <div class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">Integrate and reference</p>
          <h2 id="ecosystem-title">Practical tools on top. A normative contract underneath.</h2>
        </div>
      </div>
      <div class="uw-link-columns">
        <div>
          <h3 class="uw-column-title">Integrate</h3>
          <div class="uw-link-list">
            <a href="/guide/tools"><span><strong>Core library and CLI</strong><small>Parse, validate, calculate, convert, render, and issue receipts</small></span><code>v{{ versions.published }} · npm</code></a>
            <a href="/guide/data-lake"><span><strong>Portfolio and data lake</strong><small>Index a folder of deals into one fact table, digests intact</small></span><code>guide</code></a>
            <a href="/ai/"><span><strong>AI agents</strong><small>Instruction files, bounded skills, and the optional MCP profile</small></span><code>guide</code></a>
            <a href="/spec/http"><span><strong>HTTP and MCP bindings</strong><small>Optional profiles for services that exchange records</small></span><code>spec</code></a>
            <a href="/guide/receipts"><span><strong>Verification receipts</strong><small>Issue and check an offline proof of the arithmetic</small></span><code>guide</code></a>
          </div>
        </div>
        <div>
          <h3 class="uw-column-title">Reference</h3>
          <div class="uw-link-list">
            <a href="/spec/format-v2"><span><strong>Format specification</strong><small>Normative structure of a record</small></span><code>v{{ versions.format }}</code></a>
            <a href="/spec/protocol"><span><strong>Protocol</strong><small>Requirements for readers, editors, calculation hosts, and agents</small></span><code>v{{ versions.protocol }}</code></a>
            <a href="/spec/lite"><span><strong>UW Lite specification</strong><small>The compact <code>.uw.md</code> summary representation</small></span><code>spec</code></a>
            <a href="/spec/schemas/"><span><strong>Schemas</strong><small>JSON Schemas for every cross-boundary type</small></span><code>JSON Schema</code></a>
            <a href="/conformance/"><span><strong>Conformance corpus</strong><small>Fixture and expected-output pairs any implementation can run</small></span><code>tests</code></a>
          </div>
        </div>
      </div>
    </section>

    <section class="uw-section uw-closing" aria-labelledby="closing-title">
      <div>
        <p class="uw-eyebrow">Open and vendor-neutral</p>
        <h2 id="closing-title">MIT-licensed. Not tied to any vendor SDK, service, or model provider.</h2>
      </div>
      <nav class="uw-actions" aria-label="Project links">
        <a class="uw-button uw-button-primary" href="/about/">Why UW Markdown</a>
        <a class="uw-button" href="/about/roadmap">Roadmap</a>
        <a class="uw-text-link" href="https://github.com/UWMD-OSP/UW-Markdown">Browse source <span aria-hidden="true">→</span></a>
      </nav>
    </section>
  </main>
</template>
