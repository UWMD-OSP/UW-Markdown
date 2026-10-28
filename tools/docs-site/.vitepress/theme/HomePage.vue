<script setup>
import versions from '../../about/versions.json';
const PARKVIEW = 'Parkview-Apts-Glendale-AZ.uwx.md';
</script>

<template>
  <main class="uw-home">
    <section class="uw-hero" aria-labelledby="uw-home-title">
      <p class="uw-eyebrow">UW Markdown · Open source, open standard</p>
      <h1 id="uw-home-title">Underwriting.<br><span>In a common format.</span></h1>
      <p class="uw-intro">Deal facts, assumptions and the reasoning behind them.<br class="uw-desktop-break"> One readable record that people and software can share.</p>
      <nav class="uw-actions" aria-label="Get started"><a class="uw-button uw-button-primary" href="/tutorials/quickstart">Get started <span aria-hidden="true">→</span></a><a class="uw-button uw-button-secondary" href="/spec/format">Read the specification</a></nav>
    </section>

    <section id="example" class="uw-example" aria-labelledby="example-title">
      <header class="uw-example-toolbar"><h2 id="example-title"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 2.5h7l3 3v12H5zM11.5 2.5V6H15M8 10h4M8 13h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>parkview.uwx.md</h2><span>Synthetic example · Engineering QA</span></header>
      <div class="uw-example-spread">
        <section class="uw-source" aria-labelledby="source-title">
          <div class="uw-subhead"><h3 id="source-title">The record</h3><span>Markdown + JSON</span></div>
          <pre tabindex="0" aria-label="Excerpt of the synthetic Parkview record"><code><span class="tok-rule">---</span>
<span class="tok-key">uw_version:</span> <span class="tok-string">"3.0"</span>
<span class="tok-key">deal_name:</span> <span class="tok-string">"Parkview Apartments"</span>
<span class="tok-key">asset_class:</span> <span class="tok-string">"multifamily"</span>
<span class="tok-key">quick_metrics:</span>
  <span class="tok-key">purchase_price:</span>   <span class="tok-number">7200000</span>
  <span class="tok-key">noi_underwritten:</span> <span class="tok-number">396635</span>
  <span class="tok-key">dscr:</span>             <span class="tok-number">1.109</span>
  <span class="tok-key">ltv:</span>              <span class="tok-number">0.70</span>
<span class="tok-rule">---</span>

<span class="tok-heading">## Underwritten NOI</span>

Vacancy is normalized to 7%. Management fees
reflect the new agreement. Taxes are reassessed
to the post-sale value.

<span class="tok-rule">```json uw:section=noi_model</span>
{
  <span class="tok-key">"_meta"</span>: { <span class="tok-tail">…</span> },
  <span class="tok-key">"income"</span>: {
    <span class="tok-key">"effective_gross_income"</span>: <span class="tok-number">630936</span>
  },
  <span class="tok-key">"expenses"</span>: {
    <span class="tok-key">"total_operating_expenses"</span>: <span class="tok-number">234301</span>
  },
  <span class="tok-key">"net_operating_income"</span>: <span class="tok-number">396635</span>
}
<span class="tok-rule">```</span></code></pre>
          <p class="uw-source-note">Abbreviated for display. <a :href="`https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples/${PARKVIEW}`">Read the complete record <span aria-hidden="true">↗</span></a></p>
        </section>
        <section class="uw-render" aria-labelledby="render-title">
          <div class="uw-subhead"><h3 id="render-title">The presentation</h3><span>Illustrative view</span></div>
          <div class="uw-deal-heading"><h4>Parkview Apartments</h4><p>48 units · Glendale, Arizona · 1987 vintage</p></div>
          <dl class="uw-metrics"><div><dt>Purchase price</dt><dd>$7,200,000</dd></div><div><dt>UW NOI</dt><dd>$396,635</dd></div><div><dt>DSCR</dt><dd>1.109×</dd></div><div><dt>Stated LTV</dt><dd>70.0%</dd></div></dl>
          <div class="uw-table-wrap" tabindex="0" role="region" aria-label="Synthetic operating statement"><table>
            <caption class="uw-visually-hidden">Parkview operating statement: T-12 actuals and underwritten figures</caption>
            <thead><tr><th scope="col">Operating statement</th><th scope="col">T-12</th><th scope="col">UW</th></tr></thead>
            <tbody>
              <tr><th scope="row">Gross potential rent</th><td>$655,200</td><td>$655,200</td></tr>
              <tr><th scope="row">Vacancy / credit loss</th><td>($32,760)</td><td>($45,864)</td></tr>
              <tr><th scope="row">Other income</th><td>$18,000</td><td>$21,600</td></tr>
              <tr><th scope="row">Effective gross income</th><td>$640,440</td><td>$630,936</td></tr>
              <tr><th scope="row">Operating expenses</th><td>($228,344)</td><td>($234,301)</td></tr>
              <tr class="uw-total"><th scope="row">Net operating income</th><td>$412,096</td><td>$396,635</td></tr>
            </tbody>
          </table></div>
          <aside class="uw-verification-note" aria-label="Example verification coverage"><h4>What is checked?</h4><p>The current multifamily pack computes seven of eight outputs from this example, including DSCR, cap rate and debt yield. LTV remains stated until the loan declares its basis. Financial flags describe the deal; validation issues describe the record.</p></aside>
        </section>
      </div>
      <nav class="uw-example-links" aria-label="Work with the example"><p>One file. Multiple ways to work.</p><div><a href="/viewer/">Open the viewer <span aria-hidden="true">↗</span></a><a href="/editor/" target="_self">Try the editor <span aria-hidden="true">↗</span></a></div></nav>
    </section>

    <div class="uw-edition" aria-label="Current standard versions"><dl><div><dt>Format</dt><dd>{{ versions.specFormat }}</dd></div><div><dt>Protocol</dt><dd>{{ versions.specProtocol }}</dd></div><div><dt>Receipt</dt><dd>{{ versions.receipt }}</dd></div></dl><a href="/about/versions">All versions <span aria-hidden="true">→</span></a></div>

    <section class="uw-section uw-principles" aria-label="How UW Markdown works">
      <div><span class="uw-step">01 / READ</span><h2>A file you can read.</h2><p>Markdown carries the narrative. Typed JSON carries the structured data. Facts and assumptions stay together, with provenance.</p></div>
      <div><span class="uw-step">02 / VERIFY</span><h2>Results you can check.</h2><p>People and AI write the record. Deterministic code checks covered financial results. A receipt records what was verified, not whether source documents are true.</p><a href="/guide/receipts">How verification works →</a></div>
      <div><span class="uw-step">03 / BUILD</span><h2>An open foundation.</h2><p>Implement the standard independently or use the reference toolkit. No required vendor, hosted service or account.</p><a href="/guide/foundation">Explore the foundation →</a></div>
    </section>

    <section class="uw-section" aria-labelledby="reference-title">
      <header class="uw-section-heading"><div><p class="uw-eyebrow">Documentation</p><h2 id="reference-title">Start with the standard.<br>Build with the tools.</h2></div><p>Implement the standard independently, or use the reference toolkit. The requirements and the tools have distinct roles.</p></header>
      <div class="uw-reference-columns">
        <section aria-labelledby="standard-title"><h3 id="standard-title">The standard <span>Normative</span></h3><p>The contracts used to read and verify a record.</p><nav aria-label="Standard documents">
          <a href="/spec/format"><strong>Format specification</strong><span>Document structure, sections and provenance</span></a>
          <a href="/spec/protocol"><strong>Verification protocol</strong><span>Reader and Verifier requirements</span></a>
          <a href="/spec/metrics/"><strong>Metric dictionary</strong><span>Definitions of the builtin financial metrics</span></a>
          <a href="/conformance/"><strong>Conformance corpus</strong><span>Fixtures and expected results for implementations</span></a>
          <a href="/spec/schemas/"><strong>Schemas &amp; representations</strong><span>Structured payloads, XML and transport contracts</span></a>
        </nav></section>
        <section aria-labelledby="toolkit-title"><h3 id="toolkit-title">Reference tools <span>Non-normative</span></h3><p>Open-source tools for working with the standard.</p><nav aria-label="Reference tools">
          <a href="/guide/tools"><strong>Libraries &amp; CLI</strong><span>Read, validate, calculate and convert</span></a>
          <a href="/editor/" target="_self"><strong>Reference editor</strong><span>Author a structured record in the browser</span></a>
          <a href="/viewer/"><strong>Reference viewer</strong><span>Read a record without installing anything</span></a>
          <a href="/guide/tools#excel-converter"><strong>Excel &amp; data tools</strong><span>Workbooks, collections and database projections</span></a>
          <a href="/ai/"><strong>Working with AI</strong><span>Extract facts and write narrative within clear limits</span></a>
        </nav></section>
      </div>
    </section>

    <section class="uw-section uw-try" aria-labelledby="try-title"><div><p class="uw-eyebrow">Your first record</p><h2 id="try-title">From terminal to deal file.</h2><p>The published CLI runs with Node.js 18 or later. No account or repository clone is needed.</p><a href="/tutorials/quickstart">Follow the quickstart <span aria-hidden="true">→</span></a></div><div class="uw-command-block"><p>In your terminal</p><pre tabindex="0" aria-label="Create and validate a record"><code>npx @uwmd/cli init --output deal.uwx.md
npx @uwmd/cli validate deal.uwx.md</code></pre><a href="/downloads/">Or start from a template <span aria-hidden="true">→</span></a></div></section>
    <footer class="uw-home-footer"><p>MIT-licensed. Open and vendor-neutral.</p><nav aria-label="About the project"><a href="/about/">About UW Markdown</a><a href="/about/roadmap">Roadmap</a><a href="https://github.com/UWMD-OSP/UW-Markdown">Source on GitHub <span aria-hidden="true">↗</span></a></nav></footer>
  </main>
</template>
