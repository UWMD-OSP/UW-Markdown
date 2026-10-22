// Verification rule sets (RFC 0111, Protocol §XII.5).
//
// A record's declared Format version (`uw_version`) names the rule set it is
// verified under: the Format validation rules and §5.2 bands, the Protocol's
// verification procedures, the receipt rules and the metric dictionary. This is
// the one place verification obtains them from. Each entry points at the
// existing tables; nothing here copies data. Exactly one rule set exists today,
// Format 3.0, so its procedures are this package's code.
//
// Selection never falls back. A declared version with no entry is refused with
// `UNSUPPORTED_FORMAT_VERSION`, the code and message the parser uses (Protocol
// §XII.3), so a model built in memory cannot reach a rule set its source could
// not.

import { getPackForAssetClass } from './builtin-packs/index.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import { unsupportedFormatVersionError } from './parser.js';
import type { MetricDictionary, ModuleManifest } from './protocol.js';
import { DEFAULT_THRESHOLDS, SUPPORTED_FORMAT_VERSIONS } from './types.js';
import type { FinancialThresholds, ParsedUWFile } from './types.js';

/** The rule set a declared Format version names (RFC 0111). */
export interface UWRuleSet {
  /** The Format version that names this rule set, e.g. `"3.0"` (RFC 0111 D1). */
  readonly format_version: string;
  /** Format §5.2 financial-validity bands. */
  readonly thresholds: Readonly<FinancialThresholds>;
  /** The normative metric dictionary (`spec/metrics/builtin.json`). */
  readonly metric_dictionary: MetricDictionary;
  /**
   * The builtin calc pack verification evaluates for a class: receipt issuance
   * and verification, and builtin-class validation. Each pack equals its
   * dictionary entries (invariant 4); the normative content is the dictionary.
   */
  readonly packFor: (assetClass: string) => ModuleManifest | null;
}

const FORMAT_3_0: UWRuleSet = Object.freeze({
  format_version: '3.0',
  thresholds: DEFAULT_THRESHOLDS,
  metric_dictionary: BUILTIN_METRIC_DICTIONARY,
  packFor: getPackForAssetClass,
});

/**
 * Every rule set this implementation keeps, keyed by Format version. Its keys
 * are exactly {@link SUPPORTED_FORMAT_VERSIONS} (`rule-sets.test.ts`).
 */
export const RULE_SETS: Readonly<Record<string, UWRuleSet>> = Object.freeze({
  [FORMAT_3_0.format_version]: FORMAT_3_0,
});

/** The rule set a Format version names, or `undefined` when none is kept. */
export function getRuleSet(formatVersion: unknown): UWRuleSet | undefined {
  return typeof formatVersion === 'string' && Object.prototype.hasOwnProperty.call(RULE_SETS, formatVersion)
    ? RULE_SETS[formatVersion]
    : undefined;
}

/**
 * The rule set a record's declared `uw_version` names. Throws
 * `UNSUPPORTED_FORMAT_VERSION` (a `UWMDParseError`) when it names none.
 */
export function ruleSetFor(parsed: Pick<ParsedUWFile, 'frontmatter'>): UWRuleSet {
  const declared: unknown = parsed.frontmatter.uw_version;
  const ruleSet = getRuleSet(declared);
  if (!ruleSet) throw unsupportedFormatVersionError(declared);
  return ruleSet;
}

// The supported set and the registry are one list; a version admitted at parse
// without a rule set would have nothing to be verified under.
if (SUPPORTED_FORMAT_VERSIONS.some((version) => getRuleSet(version) === undefined)) {
  throw new Error('Every supported Format version must name a rule set (RFC 0111).');
}
