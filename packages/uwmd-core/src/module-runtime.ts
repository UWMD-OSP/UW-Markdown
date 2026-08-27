// Module runtime: actually *running* what a module manifest declares.
//
// Until now the module system registered manifests and stopped there. A
// manifest's `calculations` were reachable only by a host that pulled them out
// and evaluated them itself; its `validations` were shape-checked at load and
// then never executed by anything; its `sections` were declared and never
// looked for. Every assumption in the types was unverified, because nothing
// consumed them (RFC 0006 §Motivation).
//
// This file is the consumer. Three functions, in dependency order:
//
//   evaluateModuleCalculations  — the module's calcs, in declaration order,
//                                 each seeing the ones before it
//   checkModuleSections         — declared `required: true` sections present
//   validateAgainstModules      — the module's `validations`, plus the above
//
// **No new evaluation machinery.** A validation `rule` is a safe expression in
// exactly the §VIII.1 grammar the calc engine already parses, so it runs
// through `evaluateCalc` like any other declaration. A module that could
// evaluate rules the calc engine cannot would be a second, unsandboxed
// expression language reachable from a third-party manifest, which is the one
// thing the module system must never become.

import { evaluateCalc } from './calc/index.js';
import type { ModuleManifest, ModuleValidationDecl, CalcResult } from './protocol.js';
import type { ModuleRegistry } from './modules.js';
import type { ParsedUWFile, ValidationMessage } from './types.js';

export interface ModuleRuntimeOptions {
  /**
   * Restrict to modules declaring this asset class (plus modules that declare
   * none, which apply to all). Defaults to the file's own
   * `frontmatter.asset_class`.
   */
  assetClass?: string;
}

/** One module calculation and what it produced. */
export interface ModuleCalcOutcome {
  module_id: string;
  result: CalcResult;
}

/**
 * Evaluate every calculation the applicable modules declare, in declaration
 * order, threading each result into the next as `prior_results`.
 *
 * Order matters and is the manifest's: `revpar_index` divides by `revpar`, so
 * `revpar` must already be in `prior_results` when it runs. Sorting or
 * parallelizing would break that for no gain — and a module author who orders
 * their declarations wrongly gets a `CALC-REF` error naming the missing id,
 * which is a better failure than a silent `null`.
 */
export function evaluateModuleCalculations(
  parsed: ParsedUWFile,
  registry: ModuleRegistry,
  options: ModuleRuntimeOptions = {},
): ModuleCalcOutcome[] {
  const outcomes: ModuleCalcOutcome[] = [];
  const prior: Record<string, number | string | boolean | null> = {};

  for (const manifest of applicableModules(parsed, registry, options)) {
    for (const decl of manifest.calculations ?? []) {
      const result = evaluateCalc(decl, { parsed, prior_results: prior, locale: 'en-US' });
      outcomes.push({ module_id: manifest.id, result });
      // Only successful results are published. This is principle rather than
      // effect: an unresolved identifier already evaluates to `null` (§VIII.2),
      // so a dependent sees `null` either way — but presenting a failed
      // computation's value as a value is a different claim, and one this
      // runtime should never make.
      //
      // The effect the null-propagation DOES have is that a broken calc
      // degrades its dependents to `null`, which is indistinguishable from
      // "inputs absent". `validateAgainstModules` reports the original failure
      // as `MOD-CALC-ERROR` precisely so the cause is visible; without that,
      // one typo in a formula quietly disables every rule downstream of it.
      if (result.ok) prior[decl.id] = result.value;
    }
  }
  return outcomes;
}

/**
 * Run the applicable modules' `validations` and section requirements.
 *
 * A rule is an assertion of what must be TRUE. It fires an issue when it
 * evaluates to `false` — and, deliberately, **not** when it evaluates to
 * `null`. Null is the calc engine's "the inputs are absent", and a document
 * that simply does not carry `hotel_brand` has not violated a rule about
 * franchise fees; it has said nothing about them. Reporting absence as
 * violation would make every module rule fire on every partial file, which is
 * most files most of the time.
 *
 * A rule that fails to *evaluate* — an unknown function, an unusable argument —
 * is reported under `MOD-RULE-ERROR` rather than swallowed, and a module
 * *calculation* that fails is reported under `MOD-CALC-ERROR`. A silently
 * skipped rule is a rule the author believes is protecting them.
 */
export function validateAgainstModules(
  parsed: ParsedUWFile,
  registry: ModuleRegistry,
  options: ModuleRuntimeOptions = {},
): ValidationMessage[] {
  const issues: ValidationMessage[] = [];
  const modules = applicableModules(parsed, registry, options);

  for (const manifest of modules) {
    issues.push(...checkModuleSections(parsed, manifest));
  }

  const prior: Record<string, number | string | boolean | null> = {};
  for (const { module_id, result } of evaluateModuleCalculations(parsed, registry, options)) {
    if (result.ok) {
      prior[result.calc_id] = result.value;
      continue;
    }
    // A module calc that cannot evaluate is reported, not just skipped. Its
    // dependents will resolve to `null` and their rules will fall silent, so
    // this issue is often the only trace that anything went wrong.
    issues.push({
      code: 'MOD-CALC-ERROR',
      severity: 'error',
      message: `Module '${module_id}' calculation '${result.calc_id}' failed to evaluate: [${result.error?.code}] ${result.error?.message}`,
      remediation: `Fix the formula in '${module_id}'. Any rule that reads '${result.calc_id}' is silently inconclusive until it is corrected.`,
    });
  }

  for (const manifest of modules) {
    for (const rule of manifest.validations ?? []) {
      issues.push(...runRule(parsed, manifest, rule, prior));
    }
  }
  return issues;
}

/**
 * Sections a module declares `required: true` must be present.
 *
 * Only presence. Validating a section's contents against its declared JSON
 * Schema would need a JSON Schema validator, and `@uwmd/core` takes no such
 * dependency — see the layering invariant. The schema in the manifest is
 * normative and a host that already has a validator SHOULD apply it; core
 * checks the part it can check honestly rather than shipping a
 * half-implemented subset of JSON Schema that quietly accepts what a real
 * validator would reject.
 */
export function checkModuleSections(
  parsed: ParsedUWFile,
  manifest: ModuleManifest,
): ValidationMessage[] {
  const issues: ValidationMessage[] = [];
  for (const section of manifest.sections ?? []) {
    if (!section.required) continue;
    if (parsed.sections[section.id] === undefined) {
      issues.push({
        code: 'MOD-SECTION-MISSING',
        severity: 'error',
        section: section.id,
        message: `Module '${manifest.id}' requires section '${section.id}' (${section.display_name}), which is missing.`,
        remediation: `Add a '${section.id}' block, or stop loading '${manifest.id}' for this document.`,
      });
    }
  }
  return issues;
}

function runRule(
  parsed: ParsedUWFile,
  manifest: ModuleManifest,
  rule: ModuleValidationDecl,
  prior: Readonly<Record<string, number | string | boolean | null>>,
): ValidationMessage[] {
  const result = evaluateCalc(
    { id: rule.code, label: rule.code, formula: rule.rule, deterministic: true },
    { parsed, prior_results: prior, locale: 'en-US' },
  );

  if (!result.ok) {
    return [
      {
        code: 'MOD-RULE-ERROR',
        severity: 'error',
        message: `Module '${manifest.id}' rule '${rule.code}' failed to evaluate: [${result.error?.code}] ${result.error?.message}`,
        remediation: `Fix the rule expression in '${manifest.id}', or stop loading the module until it is corrected.`,
      },
    ];
  }

  // Absent inputs (`null`) are not violations — see the doc comment above.
  if (result.value !== false) return [];

  return [
    {
      code: rule.code,
      severity: rule.severity,
      message: rule.message,
      // Named so a reader can tell a module's finding from a built-in one
      // without memorizing which prefixes belong to whom.
      remediation: `Reported by module '${manifest.id}'.`,
    },
  ];
}

/**
 * Modules that apply to this document: those declaring its asset class, plus
 * those declaring none at all (which a manifest uses to mean "any class").
 */
function applicableModules(
  parsed: ParsedUWFile,
  registry: ModuleRegistry,
  options: ModuleRuntimeOptions,
): readonly ModuleManifest[] {
  const assetClass = options.assetClass ?? parsed.frontmatter?.asset_class;
  return registry.modules.filter(
    (m) =>
      m.asset_classes === undefined ||
      m.asset_classes.length === 0 ||
      (assetClass !== undefined && (m.asset_classes as readonly string[]).includes(assetClass)),
  );
}
