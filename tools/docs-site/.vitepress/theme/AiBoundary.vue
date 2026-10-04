<template>
  <figure class="uw-flow" aria-labelledby="uw-flow-caption">
    <ol class="uw-flow-steps">
      <li class="uw-flow-step uw-flow-input">
        <span class="uw-flow-label">01 · Sources</span>
        <strong>Deal documents</strong>
        <p>Rent roll · T-12 · lease abstracts · loan terms · market assumptions</p>
      </li>
      <li class="uw-flow-step uw-flow-judgment">
        <span class="uw-flow-label">02 · Analyst or AI</span>
        <strong>Extract and explain</strong>
        <p>Pull facts from documents, classify them, flag gaps, draft the credit narrative</p>
      </li>
      <li class="uw-flow-step uw-flow-record">
        <span class="uw-flow-label">03 · Record</span>
        <strong><code>.uwx.md</code></strong>
        <p>Facts, assumptions, narrative, and provenance in one file both sides read</p>
      </li>
      <li class="uw-flow-step uw-flow-engine">
        <span class="uw-flow-label">04 · Engine</span>
        <strong>Validate and calculate</strong>
        <p>Check structure and rules, then compute the metrics a registered calculation pack or verifier defines</p>
      </li>
      <li class="uw-flow-step uw-flow-results">
        <span class="uw-flow-label">05 · Results</span>
        <strong>Recomputed figures</strong>
        <p>DSCR · debt yield · LTV · cap rate · verified cash-flow returns, with an optional verification receipt</p>
      </li>
      <li class="uw-flow-step uw-flow-consumers">
        <span class="uw-flow-label">06 · Consumers</span>
        <strong>Every downstream system</strong>
        <p>Excel · credit memos · underwriting apps · APIs · portfolio and data systems</p>
      </li>
    </ol>
    <div class="uw-flow-bands" aria-hidden="true">
      <span class="uw-flow-band uw-flow-band-judgment">Judgment: people, parsers, or models</span>
      <span class="uw-flow-band uw-flow-band-record">Durable record</span>
      <span class="uw-flow-band uw-flow-band-math">Financial arithmetic: deterministic code only</span>
    </div>
    <figcaption id="uw-flow-caption">
      <p><strong>AI is optional.</strong> A person, a parser, or an application can write the same record. Whoever writes it, financial results come from deterministic code, not from the model's output.</p>
      <p><strong>Receipts prove derivation, not truth.</strong> A verified receipt shows the stated results follow from the record under a named pack. It does not show that the rent roll or T-12 behind it is accurate.</p>
    </figcaption>
  </figure>
</template>
