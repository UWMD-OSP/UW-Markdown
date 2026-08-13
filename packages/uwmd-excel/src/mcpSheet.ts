// The "UW MCP" sheet — machine-readable identity, provenance, and contract for
// a workbook, aimed at agents and at the reverse-import path.
//
// WHY THIS EXISTS
//
// An .xlsx is a *view* of a .uw.md record, not the record. Once it leaves the
// converter it carries no statement of where it came from, which pack drove its
// derived metrics, or whether the source document has changed since. Three
// concrete problems follow:
//
//   1. `fromWorkbook()` reads the asset class from Underwriting!B3 — a
//      positional cell next to a human label. Any layout change moves it.
//   2. Row offsets for the operating statement are computed from the CURRENT
//      layout. A workbook exported before a layout changed can therefore be
//      read at the wrong rows, or fail confusingly.
//   3. Nothing links the workbook back to its source document, so a workbook
//      exported from a since-edited deal is indistinguishable from a fresh one.
//
// This sheet fixes all three by writing a stable, keyed, machine-readable
// block: identity, the pack and layout that produced it, and the source
// document's semantic digest. `verifyWorkbookContract()` turns that into a
// three-state answer that keeps "I cannot tell" separate from "this is wrong" —
// the same distinction `receipts.ts` draws, and for the same reason.
//
// WHAT IT GIVES AN AGENT
//
// A model handed a bare .xlsx has to infer what the numbers mean. The metric
// dictionary here states, for every derived metric, its id, label, unit, and
// the *calc-engine source formula* — not the Excel translation. So an agent can
// read what `debt_yield` is defined as without reverse-engineering a cell.
//
// It also states the assurance boundary explicitly, because the most likely
// agent error with a spreadsheet is to treat a cached cell as ground truth and
// "helpfully" recompute or overwrite it. The boundary rows say plainly: derived
// metrics are pack-owned formulas, the canonical record is the .uw.md, and
// inputs only become real after going through the Tier-2 editor.
//
// NOT NORMATIVE. The .xlsx is a tool-level view; `spec/` governs .uw.md and the
// protocol. This sheet reuses the existing interchange vocabulary — envelope
// semantic digests, codec RepresentationDescriptors, the MCP deal resource URI
// — rather than inventing a parallel one, so the workbook lines up with the
// JSON/XML/CSV representations instead of drifting from them.

import type ExcelJS from 'exceljs';
import {
  CORE_CODEC_REGISTRY,
  computeEnvelopeDigest,
  toUWEnvelope,
  uwmdDealResourceURI,
} from '@uwmd/core';
import type { ParsedUWFile, ModuleCalcDecl } from '@uwmd/core';
import type { WorkbookLayout } from './layout.js';

/** Sheet name. Stable — the importer looks it up by this exact string. */
export const MCP_SHEET_NAME = 'UW MCP';

/**
 * Schema version for the sheet itself, independent of the pack, the layout, and
 * the converter. Bump when the row vocabulary changes in a way a reader must
 * notice. Readers MUST tolerate an unknown minor and MUST NOT fail closed on a
 * key they do not recognise.
 */
export const MCP_SHEET_VERSION = '1.0' as const;

/** Named range holding the canonical JSON form of the whole block. */
export const MCP_JSON_RANGE = 'uw_mcp';

/**
 * The machine-readable contract, exactly as serialized into the sheet's JSON
 * cell. Human-legible rows above it are a rendering of this same object.
 */
export interface WorkbookContract {
  mcp_sheet_version: string;
  /** Identity of the source record. */
  document: {
    uw_version: string | null;
    deal_id: string | null;
    deal_name: string | null;
    asset_class: string;
    /** Semantic digest of the source envelope at export time. */
    source_semantic_digest: string;
    /** MCP resource URI for the canonical record. */
    resource_uri: string | null;
  };
  /** What produced the derived metrics in this workbook. */
  producer: {
    pack_id: string;
    pack_version: string;
    layout_asset_class: string;
    converter: string;
  };
  /**
   * Every derived metric, with its calc-engine source formula — not the Excel
   * translation. This is what lets a reader understand the model.
   */
  metrics: Array<{
    id: string;
    label: string;
    unit: string | null;
    formula: string;
    deterministic: boolean;
  }>;
  /** Other representations of this same record, from the codec registry. */
  representations: Array<{
    id: string;
    media_types: string[];
    file_extensions: string[];
    fidelity: string;
    representation_version: string;
  }>;
  /** What a reader may and may not conclude from this workbook. */
  assurance: {
    workbook_is: 'view';
    canonical_record: string;
    derived_metrics_are: 'pack-owned formulas; not inputs';
    inputs_apply_via: 'Tier-2 editor (applyEdit); host owns _meta';
    digest_proves: 'source identity at export time; not input truth';
  };
}

const CONVERTER = '@uwmd/excel';

function frontmatterString(parsed: ParsedUWFile, key: string): string | null {
  const value = (parsed.frontmatter as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Build the contract for a parsed document + the layout that will render it.
 * The digest is computed over the envelope's semantic value, so it is stable
 * across re-exports of an unchanged document — re-exporting twice yields the
 * same digest, which is what makes staleness detectable.
 */
export async function buildWorkbookContract(
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): Promise<WorkbookContract> {
  const envelope = toUWEnvelope(parsed);
  const digest = await computeEnvelopeDigest(envelope);
  const dealId = frontmatterString(parsed, 'deal_id');

  return {
    mcp_sheet_version: MCP_SHEET_VERSION,
    document: {
      uw_version: frontmatterString(parsed, 'uw_version'),
      deal_id: dealId,
      deal_name: frontmatterString(parsed, 'deal_name'),
      asset_class: layout.assetClass,
      source_semantic_digest: digest,
      resource_uri: dealId ? uwmdDealResourceURI(dealId) : null,
    },
    producer: {
      pack_id: layout.pack.id,
      pack_version: layout.pack.version,
      layout_asset_class: layout.assetClass,
      converter: CONVERTER,
    },
    metrics: (layout.pack.calculations ?? []).map((decl: ModuleCalcDecl) => ({
      id: decl.id,
      label: decl.label,
      unit: decl.unit ?? null,
      formula: decl.formula,
      deterministic: decl.deterministic !== false,
    })),
    representations: CORE_CODEC_REGISTRY.list().map((descriptor) => ({
      id: descriptor.id,
      media_types: [...descriptor.media_types],
      file_extensions: [...descriptor.file_extensions],
      fidelity: descriptor.fidelity,
      representation_version: descriptor.representation_version,
    })),
    assurance: {
      workbook_is: 'view',
      canonical_record: '.uw.md / .uwx.md',
      derived_metrics_are: 'pack-owned formulas; not inputs',
      inputs_apply_via: 'Tier-2 editor (applyEdit); host owns _meta',
      digest_proves: 'source identity at export time; not input truth',
    },
  };
}

/** A single key/value row. `section` starts a new labelled group. */
type Row = { section: string } | { key: string; value: string | number };

function contractRows(contract: WorkbookContract): Row[] {
  const rows: Row[] = [
    { section: 'Document' },
    { key: 'uw_version', value: contract.document.uw_version ?? '' },
    { key: 'deal_id', value: contract.document.deal_id ?? '' },
    { key: 'deal_name', value: contract.document.deal_name ?? '' },
    { key: 'asset_class', value: contract.document.asset_class },
    { key: 'source_semantic_digest', value: contract.document.source_semantic_digest },
    { key: 'resource_uri', value: contract.document.resource_uri ?? '' },
    { section: 'Producer' },
    { key: 'pack_id', value: contract.producer.pack_id },
    { key: 'pack_version', value: contract.producer.pack_version },
    { key: 'converter', value: contract.producer.converter },
    { key: 'mcp_sheet_version', value: contract.mcp_sheet_version },
    { section: 'Assurance boundary' },
    { key: 'this workbook is', value: contract.assurance.workbook_is },
    { key: 'canonical record', value: contract.assurance.canonical_record },
    { key: 'derived metrics are', value: contract.assurance.derived_metrics_are },
    { key: 'inputs apply via', value: contract.assurance.inputs_apply_via },
    { key: 'digest proves', value: contract.assurance.digest_proves },
  ];
  return rows;
}

/**
 * Write the UW MCP sheet. Human-legible key/value rows, then a metric
 * dictionary, then the representation table, then one cell holding the
 * canonical JSON under the `uw_mcp` named range — so a reader can either scan
 * it or parse exactly one thing.
 */
export function writeMcpSheet(wb: ExcelJS.Workbook, contract: WorkbookContract): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(MCP_SHEET_NAME);
  sheet.columns = [{ width: 30 }, { width: 62 }, { width: 16 }, { width: 22 }, { width: 12 }];

  let row = 1;
  const writeHeading = (text: string): void => {
    const cell = sheet.getCell(`A${row}`);
    cell.value = text;
    cell.font = { bold: true };
    row++;
  };

  for (const entry of contractRows(contract)) {
    if ('section' in entry) {
      writeHeading(entry.section);
      continue;
    }
    sheet.getCell(`A${row}`).value = entry.key;
    sheet.getCell(`B${row}`).value = entry.value;
    row++;
  }

  row++;
  writeHeading('Derived metrics (pack-owned; formulas shown in calc-engine source form)');
  for (const [index, header] of ['id', 'label', 'unit', 'formula', 'deterministic'].entries()) {
    const cell = sheet.getRow(row).getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true };
  }
  row++;
  for (const metric of contract.metrics) {
    const line = sheet.getRow(row);
    line.getCell(1).value = metric.id;
    line.getCell(2).value = metric.label;
    line.getCell(3).value = metric.unit ?? '';
    line.getCell(4).value = metric.formula;
    line.getCell(5).value = metric.deterministic ? 'yes' : 'no';
    row++;
  }

  row++;
  writeHeading('Other representations of this record');
  for (const [index, header] of ['id', 'media types', 'extensions', 'fidelity', 'version'].entries()) {
    const cell = sheet.getRow(row).getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true };
  }
  row++;
  for (const representation of contract.representations) {
    const line = sheet.getRow(row);
    line.getCell(1).value = representation.id;
    line.getCell(2).value = representation.media_types.join(', ');
    line.getCell(3).value = representation.file_extensions.join(', ');
    line.getCell(4).value = representation.fidelity;
    line.getCell(5).value = representation.representation_version;
    row++;
  }

  row++;
  writeHeading('Canonical JSON (machine-readable form of everything above)');
  const jsonCell = sheet.getCell(`A${row}`);
  jsonCell.value = JSON.stringify(contract);
  jsonCell.alignment = { vertical: 'top' };
  wb.definedNames.add(`'${MCP_SHEET_NAME}'!$A$${row}`, MCP_JSON_RANGE);

  return sheet;
}

/** Read the contract back, or null when the sheet is absent or unparseable. */
export function readWorkbookContract(wb: ExcelJS.Workbook): WorkbookContract | null {
  const sheet = wb.getWorksheet(MCP_SHEET_NAME);
  if (!sheet) return null;

  const ranges = wb.definedNames.getRanges(MCP_JSON_RANGE).ranges;
  let raw: unknown;
  if (ranges.length === 1) {
    const reference = ranges[0].slice(ranges[0].lastIndexOf('!') + 1);
    raw = sheet.getCell(reference).value;
  }
  if (typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw) as WorkbookContract;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.mcp_sheet_version !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Three-state verification of a workbook against a source document.
 *
 * `unverifiable` is kept distinct from `failed` deliberately, mirroring
 * `receipts.ts`: a workbook with no MCP sheet (an older export, or one produced
 * by another tool) is not evidence of tampering, and reporting it as a failure
 * would train users to ignore the result. Only a workbook that carries a
 * contract AND disagrees with the source is a failure.
 */
export type WorkbookContractVerdict =
  | { status: 'verified'; contract: WorkbookContract }
  | { status: 'stale'; contract: WorkbookContract; expected_digest: string; reason: string }
  | { status: 'failed'; contract: WorkbookContract; reason: string }
  | { status: 'unverifiable'; reason: string };

export async function verifyWorkbookContract(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): Promise<WorkbookContractVerdict> {
  const contract = readWorkbookContract(wb);
  if (!contract) {
    return {
      status: 'unverifiable',
      reason: `Workbook carries no readable "${MCP_SHEET_NAME}" sheet — it predates the contract or came from another tool.`,
    };
  }

  if (contract.document.asset_class !== layout.assetClass) {
    return {
      status: 'failed',
      contract,
      reason: `Workbook was produced for asset class "${contract.document.asset_class}" but is being read as "${layout.assetClass}".`,
    };
  }

  if (contract.producer.pack_id !== layout.pack.id) {
    return {
      status: 'failed',
      contract,
      reason: `Workbook was produced by pack "${contract.producer.pack_id}" but the current pack is "${layout.pack.id}".`,
    };
  }

  // A pack version bump can add or redefine metrics, so the row geometry and
  // metric set may differ. That is staleness, not tampering.
  if (contract.producer.pack_version !== layout.pack.version) {
    return {
      status: 'stale',
      contract,
      expected_digest: contract.document.source_semantic_digest,
      reason: `Workbook was produced by ${contract.producer.pack_id}@${contract.producer.pack_version}; the current pack is @${layout.pack.version}.`,
    };
  }

  const expected = await computeEnvelopeDigest(toUWEnvelope(parsed));
  if (expected !== contract.document.source_semantic_digest) {
    return {
      status: 'stale',
      contract,
      expected_digest: expected,
      reason:
        'The source document has changed since this workbook was exported; importing it would apply values derived from an older record.',
    };
  }

  return { status: 'verified', contract };
}
