import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectPropertyCashFlowInputs } from './property-cash-flow-inputs.js';
import { parseUWFile } from './parser.js';
import { periodPayload, periodSection } from './period-path.js';

const source = readFileSync(new URL('../../../docs/examples/property-cash-flow-synthetic.uwx.md', import.meta.url), 'utf8');

describe('RFC 0047 property cash-flow input inventory', () => {
  it('reports source variants, periods, rows and required coverage without assigning economics', () => {
    const inventory = inspectPropertyCashFlowInputs(parseUWFile(source));
    expect(inventory.currency_code).toBeNull();
    expect(inventory.lease_up_schedule[0]).toMatchObject({ variant: 'base', shape: 'usable', rows: [] });
    expect(inventory.lease_up_schedule[0]!.periods.length).toBeGreaterThan(0);
    expect(inventory.lease_up_schedule[0]!.required_coverage_cells).toContain('2026-Q3/operating_expenses');
    expect(inventory.cash_flow_series[0]).toMatchObject({ variant: 'base', shape: 'usable', stated_metrics: [] });
    expect(inventory.cash_flow_series[0]!.rows[0]).toMatchObject({ index: 0, date: '2026-07-01', amount: -1000000 });
    expect(inventory.notes.join(' ')).toContain('does not establish metric verification');
  });

  it('marks malformed source shape instead of manufacturing an empty source', () => {
    const parsed = parseUWFile(source);
    const lease = periodSection(parsed, 'lease_up_schedule', { sectionVariants: { lease_up_schedule: 'base' } })!;
    (periodPayload(lease) as Record<string, unknown>).schedule = [{ period: null }];
    const inventory = inspectPropertyCashFlowInputs(parsed);
    expect(inventory.lease_up_schedule[0]).toMatchObject({ shape: 'malformed', periods: [], required_coverage_cells: [] });
  });
});
