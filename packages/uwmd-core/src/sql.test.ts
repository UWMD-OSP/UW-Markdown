import { describe, it, expect } from 'vitest';
import { exportSql, exportSqlStatements, UWSqlError } from './sql.js';
import type { UWDocumentEnvelope } from './envelope.js';

describe('exportSql / exportSqlStatements', () => {
  const sampleEnvelope: UWDocumentEnvelope = {
    envelope_version: '1.0',
    format_version: '1.1',
    semantic_digest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    frontmatter: {
      deal_id: 'deal_123',
      deal_name: "O'Connor Court Apartments",
      asset_class: 'multifamily',
      deal_stage: 'full_underwrite',
      quick_metrics: {
        purchase_price: 10000000,
        loan_amount: 7000000,
        noi_underwritten: 550000,
        dscr: 1.25,
        ltv: 0.7,
        debt_yield: 0.0785,
        cap_rate: 0.055,
        irr_projected: 0.12,
      },
    } as unknown as UWDocumentEnvelope['frontmatter'],
    sections: {
      valuation: {
        annotation: { section: 'valuation' },
        content: {
          _meta: { section: 'valuation', version: 1 },
          purchase_price: 10000000,
          purchase_price_per_unit: 200000,
          purchase_price_per_sqft: 250,
          appraised_value: 10500000,
          cap_rate_in_place: 0.055,
          target_irr: 0.12,
          exit_cap_rate: 0.06,
        },
      },
      debt_structure: {
        annotation: { section: 'debt_structure' },
        content: {
          _meta: { section: 'debt_structure', version: 1 },
          loan_amount: 7000000,
          interest_rate: 0.0575,
          amortization_years: 30,
          loan_term_years: 10,
          annual_debt_service: 490000,
          monthly_debt_service: 40833.33,
        },
      },
      rent_roll: {
        annotation: { section: 'rent_roll' },
        content: {
          _meta: { section: 'rent_roll', version: 1 },
          total_units: 2,
          occupied_units: 2,
          vacant_units: 0,
          physical_occupancy_pct: 1.0,
          gross_potential_rent_monthly: 25000,
          in_place_rent_monthly: 25000,
          units: [
            {
              unit_id: '101',
              tenant_name: "John O'Connor",
              square_feet: 850,
              in_place_rent: 12000,
              lease_start: '2025-01-01',
              lease_end: '2026-01-01',
            },
            {
              unit_id: '102',
              tenant_name: 'Acme Corp',
              square_feet: 950,
              in_place_rent: 13000,
              lease_start: '2025-06-01',
              lease_end: '2027-06-01',
            },
          ],
        },
      },
    },
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
  };

  it('throws UWSqlError when semantic_digest is missing', () => {
    const invalid = { ...sampleEnvelope, semantic_digest: undefined };
    expect(() => exportSql(invalid)).toThrowError(UWSqlError);
    expect(() => exportSql(invalid)).toThrowError(/SQL_MISSING_DIGEST/);
  });

  it('generates DDL tables and indexes for postgres', () => {
    const sql = exportSql(sampleEnvelope, { includeInserts: false });
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_documents');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_deal_sections');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_section_valuation');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_section_debt');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_section_rent_roll');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS uw_section_rent_roll_summary');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS uw_documents_deal_id_idx');
  });

  it('generates PostgreSQL JSONB staging views', () => {
    const sql = exportSql(sampleEnvelope, { includeDdl: false, includeInserts: false });
    expect(sql).toContain('CREATE OR REPLACE VIEW view_deal_summary');
    expect(sql).toContain('CREATE OR REPLACE VIEW view_valuation');
    expect(sql).toContain('CREATE OR REPLACE VIEW view_debt');
    expect(sql).toContain('CREATE OR REPLACE VIEW view_rent_roll');
    expect(sql).toContain("envelope->'sections'->'valuation'");
    expect(sql).toContain("envelope->'sections'->'debt_structure'");
    expect(sql).toContain("jsonb_array_elements");
  });

  it('generates INSERT statements with properly escaped strings and numbers', () => {
    const sql = exportSql(sampleEnvelope, { includeDdl: false, includeViews: false });
    expect(sql).toContain('INSERT INTO uw_documents');
    expect(sql).toContain("'O''Connor Court Apartments'");
    expect(sql).toContain('INSERT INTO uw_section_valuation');
    expect(sql).toContain('10000000'); // purchase price
    expect(sql).toContain('INSERT INTO uw_section_debt');
    expect(sql).toContain('7000000'); // loan amount
    expect(sql).toContain('360'); // 30 years * 12 months
    expect(sql).toContain('INSERT INTO uw_section_rent_roll_summary');
    expect(sql).toContain('INSERT INTO uw_section_rent_roll');
    expect(sql).toContain("'101'");
    expect(sql).toContain("'John O''Connor'");
    expect(sql).toContain('12000');
    expect(sql).toContain("'102'");
  });

  it('qualifies tables and creates schema when schema option is provided', () => {
    const sql = exportSql(sampleEnvelope, { schema: 'cre_lake' });
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS cre_lake;');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cre_lake.uw_documents');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cre_lake.uw_section_valuation');
    expect(sql).toContain('CREATE OR REPLACE VIEW cre_lake.view_deal_summary');
    expect(sql).toContain('INSERT INTO cre_lake.uw_documents');
  });

  it('supports snowflake dialect', () => {
    const sql = exportSql(sampleEnvelope, { dialect: 'snowflake' });
    expect(sql).toContain('envelope          VARIANT NOT NULL');
    expect(sql).toContain('MERGE INTO uw_documents t');
    expect(sql).toContain('PARSE_JSON(');
  });
});
