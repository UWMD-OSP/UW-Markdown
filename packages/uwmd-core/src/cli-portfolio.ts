// CLI commands for RFC 0015: portfolio & relationship profile sidecars.
//
// Node-side commands reached only through the CLI entry point, never from
// browser.ts. Split from cli-packages.ts because that file is the RFC 0018
// surface and this is a different RFC's; both follow the same conventions.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validatePortfolioProfile,
  uninterpretedPortfolioTypes,
  getPortfolioRelationships,
  type PortfolioProfile,
} from './portfolio.js';
import type { ProtocolError } from './protocol.js';

type Flags = Record<string, string | boolean>;

function readJSONFile(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf-8')) as unknown;
}

function printErrors(errors: readonly ProtocolError[]): void {
  for (const e of errors) {
    console.log(`  ${e.code}${e.pointer ? ` [${e.pointer}]` : ''} ${e.message}`);
  }
}

/** `uwmd portfolio validate <sidecar.uwportfolio.json> [--json]` */
export function cmdPortfolioValidate(path: string, flags: Flags): void {
  const candidate = readJSONFile(path);
  const errors = validatePortfolioProfile(candidate);
  const uninterpreted = errors.length === 0
    ? uninterpretedPortfolioTypes(candidate as PortfolioProfile)
    : { entity_types: [], edge_types: [] };

  if (flags['json']) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, uninterpreted }, null, 2));
  } else if (errors.length === 0) {
    const profile = candidate as PortfolioProfile;
    console.log(`OK — ${profile.entities.length} entities, ${profile.edges.length} edges.`);
    for (const [label, types] of [
      ['entity', uninterpreted.entity_types],
      ['edge', uninterpreted.edge_types],
    ] as const) {
      if (types.length > 0) {
        console.log(`  note: uninterpreted ${label} type(s) preserved: ${types.join(', ')}`);
      }
    }
  } else {
    console.log(`INVALID — ${errors.length} error(s):`);
    printErrors(errors);
  }
  if (errors.length > 0) process.exit(1);
}

/** `uwmd portfolio edges <sidecar.uwportfolio.json> [--entity <id>] [--json]` */
export function cmdPortfolioEdges(path: string, flags: Flags): void {
  const candidate = readJSONFile(path);
  const errors = validatePortfolioProfile(candidate);
  if (errors.length > 0) {
    console.error(`Refusing to project an invalid profile — run \`uwmd portfolio validate ${path}\`.`);
    printErrors(errors);
    process.exit(1);
  }
  const entityId = typeof flags['entity'] === 'string' ? flags['entity'] : undefined;
  const edges = getPortfolioRelationships(candidate as PortfolioProfile, entityId);
  if (flags['json']) {
    console.log(JSON.stringify(edges, null, 2));
  } else {
    for (const e of edges) {
      console.log(`${e.id}: ${e.from} —${e.type}→ ${e.to} (${e.provenance.length} provenance)`);
    }
    if (edges.length === 0) console.log('(no edges)');
  }
}
