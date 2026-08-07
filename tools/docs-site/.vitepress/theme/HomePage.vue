<template>
  <main class="uw-home">
    <section class="uw-hero" aria-labelledby="uw-home-title">
      <div class="uw-hero-copy">
        <div class="uw-kicker"><span class="uw-file-mark" aria-hidden="true">UW</span> Open underwriting interoperability standard</div>
        <h1 id="uw-home-title"><code>.uw.md</code> is the canonical data contract for underwriting systems.</h1>
        <p class="uw-lede">AI-ready. Code-verifiable. Portable across systems.</p>
        <p class="uw-intro">UW Markdown gives AI agents, deterministic calculation services, internal platforms, and any compatible editor or viewer one stable underwriting record to exchange and extend.</p>
        <nav class="uw-actions" aria-label="Get started">
          <a class="uw-button uw-button-primary" href="/spec/protocol">Explore the protocol</a>
          <a class="uw-button" href="/ai/">Build with AI and code</a>
          <a class="uw-text-link" href="https://github.com/UWMD-OSP/UW-Markdown">Source on GitHub <span aria-hidden="true">→</span></a>
        </nav>
      </div>

      <aside class="uw-release-card" aria-label="Current release status">
        <div class="uw-panel-bar">
          <span>PROJECT STATUS</span>
          <span class="uw-status uw-status-valid">ACTIVE</span>
        </div>
        <dl>
          <div><dt>Format</dt><dd><code>v1.1</code></dd></div>
          <div><dt>Protocol</dt><dd><code>v1.2.0</code></dd></div>
          <div><dt>Core</dt><dd><code>v1.1.0-rc</code></dd></div>
          <div><dt>License</dt><dd>MIT</dd></div>
          <div><dt>Updated</dt><dd><time datetime="2026-07-28">2026-07-28</time></dd></div>
        </dl>
        <p>Source is public. The first npm release is pending.</p>
        <a href="/about/versions">Version matrix</a>
      </aside>
    </section>

    <div class="uw-trust-strip" aria-label="Format summary">
      <span><strong>CANONICAL RECORD</strong> Deal facts + provenance</span>
      <span><strong>DETERMINISTIC</strong> Validation + calculation</span>
      <span><strong>REPRESENTATIONS</strong> Markdown / JSON / XML / CSV</span>
      <span><strong>INTEROPERABLE</strong> Agents / tools / systems</span>
    </div>

    <section id="example" class="uw-section uw-example" aria-labelledby="example-title">
      <header class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">One canonical record</p>
          <h2 id="example-title">The same underwriting data works everywhere.</h2>
        </div>
        <a href="https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples/Parkview-Apts-Glendale-AZ.uw.md">Open complete example <span aria-hidden="true">→</span></a>
      </header>

      <div class="uw-file-window">
        <div class="uw-file-header">
          <span class="uw-file-name"><span class="uw-file-mini" aria-hidden="true">UW</span> Parkview-Apts-Glendale-AZ.uw.md</span>
          <span class="uw-file-state"><span class="uw-status uw-status-valid">VALID</span><span class="uw-status uw-status-info">COMPUTED</span></span>
        </div>
        <div class="uw-file-views">
          <section class="uw-source" aria-labelledby="source-title">
            <div class="uw-subhead"><h3 id="source-title">Canonical record</h3><span>portable source</span></div>
            <pre><code><span class="tok-rule">---</span>
<span class="tok-key">uw_version:</span> <span class="tok-string">"1.1"</span>
<span class="tok-key">deal_name:</span> <span class="tok-string">"Parkview Apartments"</span>
<span class="tok-key">asset_class:</span> <span class="tok-string">"multifamily"</span>
<span class="tok-key">quick_metrics:</span>
  <span class="tok-key">purchase_price:</span> <span class="tok-number">7200000</span>
  <span class="tok-key">noi_underwritten:</span> <span class="tok-number">396635</span>
  <span class="tok-key">dscr:</span> <span class="tok-number">1.109</span>
  <span class="tok-key">ltv:</span> <span class="tok-number">0.70</span>
<span class="tok-rule">---</span>

<span class="tok-heading">## Underwritten NOI</span>

Vacancy is normalized to 7%. Management
fees use the new agreement at 5.5% of EGI.

<span class="tok-code">```json uw:section=noi_model</span>
{
  <span class="tok-json">"effective_gross_income"</span>: <span class="tok-number">630936</span>,
  <span class="tok-json">"total_operating_expenses"</span>: <span class="tok-number">234301</span>,
  <span class="tok-json">"net_operating_income"</span>: <span class="tok-number">396635</span>
}
<span class="tok-code">```</span></code></pre>
          </section>

          <section class="uw-render" aria-labelledby="render-title">
            <div class="uw-subhead"><h3 id="render-title">Compatible consumer</h3><span>underwriting view</span></div>
            <div class="uw-deal-heading">
              <p>Parkview Apartments</p>
              <span>48 units · Glendale, Arizona</span>
            </div>
            <div class="uw-metrics">
              <div><span>Purchase price</span><strong>$7,200,000</strong></div>
              <div><span>UW NOI</span><strong>$396,635</strong></div>
              <div><span>DSCR</span><strong>1.109×</strong></div>
              <div><span>LTV</span><strong>70.0%</strong></div>
            </div>
            <div class="uw-table-wrap">
              <table>
                <thead><tr><th>Operating statement</th><th>T-12</th><th>UW</th></tr></thead>
                <tbody>
                  <tr><td>Gross potential rent</td><td>$655,200</td><td>$655,200</td></tr>
                  <tr><td>Vacancy / credit loss</td><td>($32,760)</td><td>($45,864)</td></tr>
                  <tr><td>Effective gross income</td><td>$640,440</td><td>$630,936</td></tr>
                  <tr><td>Total operating expenses</td><td>($228,344)</td><td>($234,301)</td></tr>
                  <tr class="uw-total"><td>Net operating income</td><td>$412,096</td><td>$396,635</td></tr>
                </tbody>
              </table>
            </div>
            <div class="uw-check"><span aria-hidden="true">✓</span><p><strong>Deterministic calculation complete</strong><br>No AI arithmetic. Inputs resolved by the multifamily calculation pack.</p></div>
          </section>
        </div>
        <div class="uw-file-footer"><span>FORMAT 1.1 · analyst tier · append-only history</span><a href="/viewer/">Open in reference viewer</a></div>
      </div>
    </section>

    <section class="uw-section" aria-labelledby="capabilities-title">
      <div class="uw-section-heading uw-section-heading-narrow">
        <div>
          <p class="uw-eyebrow">What the format provides</p>
          <h2 id="capabilities-title">A durable interchange layer for underwriting.</h2>
        </div>
      </div>
      <div class="uw-capability-grid">
        <article><span class="uw-index">01</span><h3>Code-native</h3><p>Typed sections, schemas, and conformance make the record dependable software input.</p></article>
        <article><span class="uw-index">02</span><h3>AI-ready</h3><p>Agents can extract, reason over, and propose changes against one shared contract.</p></article>
        <article><span class="uw-index">03</span><h3>Deterministic</h3><p>Validators and calculation hosts check consistency and own all underwriting math.</p></article>
        <article><span class="uw-index">04</span><h3>Interoperable</h3><p>Any compatible platform, editor, viewer, or service can load the same record.</p></article>
      </div>
    </section>

    <section class="uw-section uw-how" aria-labelledby="how-title">
      <div class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">How it works</p>
          <h2 id="how-title">One record in. Any compatible underwriting system out.</h2>
        </div>
        <a href="/tutorials/your-first-uwmd-file">Build your first file <span aria-hidden="true">→</span></a>
      </div>
      <ol class="uw-steps">
        <li><span>1</span><div><strong>Ingest the record</strong><p>Any compatible tool, service, or agent loads the same <code>.uw.md</code> deal.</p></div></li>
        <li><span>2</span><div><strong>Parse shared facts</strong><p>Structured sections give every consumer a stable underwriting vocabulary.</p></div></li>
        <li><span>3</span><div><strong>Validate and compute</strong><p>Conforming hosts enforce rules and run deterministic calculation packs.</p></div></li>
        <li><span>4</span><div><strong>Preserve the record</strong><p>Changes supersede prior blocks without destroying provenance or history.</p></div></li>
      </ol>
    </section>

    <section class="uw-section uw-ecosystem" aria-labelledby="ecosystem-title">
      <div class="uw-section-heading">
        <div>
          <p class="uw-eyebrow">Standard and reference tools</p>
          <h2 id="ecosystem-title">Open rules, practical implementations.</h2>
        </div>
      </div>
      <div class="uw-link-list">
        <a href="/spec/format"><span><strong>Format specification</strong><small>Normative structure of a .uw.md file</small></span><code>v1.1</code></a>
        <a href="/spec/protocol"><span><strong>Protocol</strong><small>Requirements for readers, editors, calc hosts, and agents</small></span><code>v1.2.0</code></a>
        <a href="/conformance/"><span><strong>Conformance corpus</strong><small>Fixtures that prove implementation behavior</small></span><code>29 fixtures</code></a>
        <a href="/guide/tools"><span><strong>Core library and CLI</strong><small>Parse, validate, calculate, convert, and render</small></span><code>source release</code></a>
        <a href="/viewer/"><span><strong>Reference viewer</strong><small>Read a file locally in a browser</small></span><code>Tier 1</code></a>
        <a href="https://www.uwmd.org/editor/"><span><strong>Reference editor</strong><small>Edit, validate, calculate, diff, and export</small></span><code>public preview</code></a>
      </div>
    </section>

    <section class="uw-section uw-closing" aria-labelledby="closing-title">
      <div>
        <p class="uw-eyebrow">Start with the artifact</p>
        <h2 id="closing-title">One underwriting record. Open rules. Every compatible system.</h2>
      </div>
      <nav class="uw-actions" aria-label="Project links">
        <a class="uw-button uw-button-primary" href="/ai/">Build with AI and code</a>
        <a class="uw-button" href="/spec/protocol">Read the protocol</a>
        <a class="uw-text-link" href="https://github.com/UWMD-OSP/UW-Markdown">Browse source <span aria-hidden="true">→</span></a>
      </nav>
    </section>
  </main>
</template>
