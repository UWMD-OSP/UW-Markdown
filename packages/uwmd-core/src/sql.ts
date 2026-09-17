import type { UWDocumentEnvelope, UWEnvelopeBlock } from './envelope.js';

export class UWSqlError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWSqlError';
    this.code = code;
  }
}

export interface ExportSqlOptions {
  /** Target schema name. Default 'public'. */
  schema?: string;
  /** Whether to include DDL CREATE TABLE and CREATE INDEX statements. Default true. */
  includeDdl?: boolean;
  /** Whether to include CREATE VIEW staging views. Default true. */
  includeViews?: boolean;
  /** Whether to include INSERT data statements. Default true. */
  includeInserts?: boolean;
  /** SQL dialect. 'postgres' (default) or 'snowflake'. */
  dialect?: 'postgres' | 'snowflake';
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${escapeSqlString(value)}'`;
}

function sqlNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'NULL';
  return String(value);
}

function sqlDate(value: string | null | undefined, dialect: 'postgres' | 'snowflake'): string {
  if (!value) return 'NULL';
  const clean = escapeSqlString(value);
  return dialect === 'snowflake' ? `TO_DATE('${clean}')` : `'${clean}'::date`;
}

function sqlJson(value: unknown, dialect: 'postgres' | 'snowflake'): string {
  if (value === null || value === undefined) return 'NULL';
  const jsonStr = escapeSqlString(JSON.stringify(value));
  return dialect === 'snowflake' ? `PARSE_JSON('${jsonStr}')` : `'${jsonStr}'::jsonb`;
}

function qualify(schema: string | undefined, tableOrView: string): string {
  if (!schema || schema === 'public') return tableOrView;
  return `${schema}.${tableOrView}`;
}

function isBlock(value: unknown): value is UWEnvelopeBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    'annotation' in value &&
    'content' in value
  );
}

function getSectionBlock(envelope: UWDocumentEnvelope, sectionId: string): UWEnvelopeBlock | null {
  const entry = envelope.sections[sectionId];
  if (!entry) return null;
  if (isBlock(entry)) return entry;
  // If variant map, take 'default' or 'base' or the first variant
  const keys = Object.keys(entry);
  if (keys.length === 0) return null;
  const preferred = entry['default'] ?? entry['base'] ?? entry[keys[0]!];
  return isBlock(preferred) ? preferred : null;
}

/**
 * Returns an array of SQL statements (DDL, staging views, and INSERTs)
 * for ingesting a UWMD document into a relational database or data lake.
 */
export function exportSqlStatements(
  envelope: UWDocumentEnvelope,
  options: ExportSqlOptions = {},
): string[] {
  const schema = options.schema ?? 'public';
  const includeDdl = options.includeDdl ?? true;
  const includeViews = options.includeViews ?? true;
  const includeInserts = options.includeInserts ?? true;
  const dialect = options.dialect ?? 'postgres';

  if (!envelope.semantic_digest) {
    throw new UWSqlError(
      'SQL_MISSING_DIGEST',
      'Cannot export SQL for document without a semantic_digest.',
    );
  }

  const statements: string[] = [];
  const q = (name: string) => qualify(schema, name);

  // ─── DDL ──────────────────────────────────────────────────────────────────
  if (includeDdl) {
    if (schema !== 'public') {
      statements.push(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    }

    if (dialect === 'postgres') {
      // 1. Documents master table
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_documents')} (
  semantic_digest   text PRIMARY KEY,
  deal_id           text,
  deal_name         text,
  asset_class       text,
  deal_stage        text,
  envelope          jsonb NOT NULL,
  loaded_at         timestamptz NOT NULL DEFAULT now()
);`);

      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_documents_deal_id_idx ON ${q('uw_documents')} (deal_id);`,
      );
      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_documents_asset_class_idx ON ${q('uw_documents')} (asset_class, deal_stage);`,
      );
      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_documents_envelope_idx ON ${q('uw_documents')} USING gin (envelope jsonb_path_ops);`,
      );

      // 2. Sections generic staging table
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_deal_sections')} (
  semantic_digest   text NOT NULL REFERENCES ${q('uw_documents')} (semantic_digest) ON DELETE CASCADE,
  section_id        text NOT NULL,
  variant           text NOT NULL DEFAULT 'default',
  content           jsonb NOT NULL,
  meta              jsonb,
  PRIMARY KEY (semantic_digest, section_id, variant)
);`);

      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_deal_sections_section_idx ON ${q('uw_deal_sections')} (section_id);`,
      );
      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_deal_sections_content_idx ON ${q('uw_deal_sections')} USING gin (content jsonb_path_ops);`,
      );

      // 3. Extracted Valuation table
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_valuation')} (
  semantic_digest         text NOT NULL REFERENCES ${q('uw_documents')} (semantic_digest) ON DELETE CASCADE,
  deal_id                 text,
  purchase_price          numeric,
  purchase_price_per_unit numeric,
  purchase_price_per_sqft numeric,
  cap_rate_in_place       double precision,
  target_irr              double precision,
  exit_cap_rate           double precision,
  appraised_value         numeric,
  valuation_data          jsonb NOT NULL,
  PRIMARY KEY (semantic_digest)
);`);

      // 4. Extracted Debt table
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_debt')} (
  semantic_digest      text NOT NULL REFERENCES ${q('uw_documents')} (semantic_digest) ON DELETE CASCADE,
  deal_id              text,
  loan_amount          numeric,
  interest_rate        double precision,
  amortization_months  integer,
  term_months          integer,
  annual_debt_service  numeric,
  monthly_debt_service numeric,
  debt_data            jsonb NOT NULL,
  PRIMARY KEY (semantic_digest)
);`);

      // 5. Extracted Rent Roll tables (summary & unit detail)
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_rent_roll_summary')} (
  semantic_digest              text NOT NULL REFERENCES ${q('uw_documents')} (semantic_digest) ON DELETE CASCADE,
  deal_id                      text,
  total_units                  integer,
  occupied_units               integer,
  vacant_units                 integer,
  physical_occupancy_pct       double precision,
  gross_potential_rent_monthly numeric,
  in_place_rent_monthly        numeric,
  rent_roll_data               jsonb NOT NULL,
  PRIMARY KEY (semantic_digest)
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_rent_roll')} (
  semantic_digest   text NOT NULL REFERENCES ${q('uw_documents')} (semantic_digest) ON DELETE CASCADE,
  deal_id           text,
  unit_id           text NOT NULL,
  tenant_name       text,
  square_feet       numeric,
  in_place_rent     numeric,
  lease_start       date,
  lease_end         date,
  unit_data         jsonb NOT NULL,
  PRIMARY KEY (semantic_digest, unit_id)
);`);
      statements.push(
        `CREATE INDEX IF NOT EXISTS uw_section_rent_roll_deal_idx ON ${q('uw_section_rent_roll')} (deal_id);`,
      );
    } else {
      // Snowflake DDL
      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_documents')} (
  semantic_digest   VARCHAR PRIMARY KEY,
  deal_id           VARCHAR,
  deal_name         VARCHAR,
  asset_class       VARCHAR,
  deal_stage        VARCHAR,
  envelope          VARIANT NOT NULL,
  loaded_at         TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_deal_sections')} (
  semantic_digest   VARCHAR NOT NULL,
  section_id        VARCHAR NOT NULL,
  variant           VARCHAR NOT NULL DEFAULT 'default',
  content           VARIANT NOT NULL,
  meta              VARIANT,
  PRIMARY KEY (semantic_digest, section_id, variant)
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_valuation')} (
  semantic_digest         VARCHAR NOT NULL PRIMARY KEY,
  deal_id                 VARCHAR,
  purchase_price          NUMBER(18, 2),
  purchase_price_per_unit NUMBER(18, 2),
  purchase_price_per_sqft NUMBER(18, 2),
  cap_rate_in_place       FLOAT,
  target_irr              FLOAT,
  exit_cap_rate           FLOAT,
  appraised_value         NUMBER(18, 2),
  valuation_data          VARIANT NOT NULL
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_debt')} (
  semantic_digest      VARCHAR NOT NULL PRIMARY KEY,
  deal_id              VARCHAR,
  loan_amount          NUMBER(18, 2),
  interest_rate        FLOAT,
  amortization_months  INTEGER,
  term_months          INTEGER,
  annual_debt_service  NUMBER(18, 2),
  monthly_debt_service NUMBER(18, 2),
  debt_data            VARIANT NOT NULL
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_rent_roll_summary')} (
  semantic_digest              VARCHAR NOT NULL PRIMARY KEY,
  deal_id                      VARCHAR,
  total_units                  INTEGER,
  occupied_units               INTEGER,
  vacant_units                 INTEGER,
  physical_occupancy_pct       FLOAT,
  gross_potential_rent_monthly NUMBER(18, 2),
  in_place_rent_monthly        NUMBER(18, 2),
  rent_roll_data               VARIANT NOT NULL
);`);

      statements.push(`CREATE TABLE IF NOT EXISTS ${q('uw_section_rent_roll')} (
  semantic_digest   VARCHAR NOT NULL,
  deal_id           VARCHAR,
  unit_id           VARCHAR NOT NULL,
  tenant_name       VARCHAR,
  square_feet       NUMBER(18, 2),
  in_place_rent     NUMBER(18, 2),
  lease_start       DATE,
  lease_end         DATE,
  unit_data         VARIANT NOT NULL,
  PRIMARY KEY (semantic_digest, unit_id)
);`);
    }
  }

  // ─── Staging Views ────────────────────────────────────────────────────────
  if (includeViews && dialect === 'postgres') {
    statements.push(`CREATE OR REPLACE VIEW ${q('view_deal_summary')} AS
SELECT
  semantic_digest,
  deal_id,
  deal_name,
  asset_class,
  deal_stage,
  (envelope->'frontmatter'->'quick_metrics'->>'purchase_price')::numeric AS purchase_price,
  (envelope->'frontmatter'->'quick_metrics'->>'loan_amount')::numeric AS loan_amount,
  (envelope->'frontmatter'->'quick_metrics'->>'noi_underwritten')::numeric AS noi_underwritten,
  (envelope->'frontmatter'->'quick_metrics'->>'dscr')::double precision AS dscr,
  (envelope->'frontmatter'->'quick_metrics'->>'ltv')::double precision AS ltv,
  (envelope->'frontmatter'->'quick_metrics'->>'debt_yield')::double precision AS debt_yield,
  (envelope->'frontmatter'->'quick_metrics'->>'cap_rate')::double precision AS cap_rate,
  (envelope->'frontmatter'->'quick_metrics'->>'irr_projected')::double precision AS irr_projected
FROM ${q('uw_documents')};`);

    statements.push(`CREATE OR REPLACE VIEW ${q('view_valuation')} AS
SELECT
  semantic_digest,
  deal_id,
  (envelope->'sections'->'valuation'->'content'->>'purchase_price')::numeric AS purchase_price,
  (envelope->'sections'->'valuation'->'content'->>'purchase_price_per_unit')::numeric AS purchase_price_per_unit,
  (envelope->'sections'->'valuation'->'content'->>'purchase_price_per_sqft')::numeric AS purchase_price_per_sqft,
  (envelope->'sections'->'valuation'->'content'->>'appraised_value')::numeric AS appraised_value,
  COALESCE(
    (envelope->'sections'->'valuation'->'content'->>'cap_rate_in_place')::double precision,
    (envelope->'sections'->'valuation'->'content'->>'cap_rate')::double precision
  ) AS cap_rate_in_place,
  (envelope->'sections'->'valuation'->'content'->>'target_irr')::double precision AS target_irr,
  (envelope->'sections'->'valuation'->'content'->>'exit_cap_rate')::double precision AS exit_cap_rate,
  envelope->'sections'->'valuation'->'content' AS content
FROM ${q('uw_documents')}
WHERE envelope->'sections' ? 'valuation';`);

    statements.push(`CREATE OR REPLACE VIEW ${q('view_debt')} AS
SELECT
  semantic_digest,
  deal_id,
  (envelope->'sections'->'debt_structure'->'content'->>'loan_amount')::numeric AS loan_amount,
  (envelope->'sections'->'debt_structure'->'content'->>'interest_rate')::double precision AS interest_rate,
  (envelope->'sections'->'debt_structure'->'content'->>'annual_debt_service')::numeric AS annual_debt_service,
  (envelope->'sections'->'debt_structure'->'content'->>'monthly_debt_service')::numeric AS monthly_debt_service,
  COALESCE(
    (envelope->'sections'->'debt_structure'->'content'->>'amortization_months')::integer,
    ((envelope->'sections'->'debt_structure'->'content'->>'amortization_years')::numeric * 12)::integer
  ) AS amortization_months,
  COALESCE(
    (envelope->'sections'->'debt_structure'->'content'->>'loan_term_months')::integer,
    ((envelope->'sections'->'debt_structure'->'content'->>'loan_term_years')::numeric * 12)::integer
  ) AS term_months,
  envelope->'sections'->'debt_structure'->'content' AS content
FROM ${q('uw_documents')}
WHERE envelope->'sections' ? 'debt_structure';`);

    statements.push(`CREATE OR REPLACE VIEW ${q('view_rent_roll')} AS
SELECT
  d.semantic_digest,
  d.deal_id,
  u->>'unit_id' AS unit_id,
  u->>'tenant_name' AS tenant_name,
  (u->>'square_feet')::numeric AS square_feet,
  COALESCE((u->>'in_place_rent')::numeric, (u->>'monthly_rent')::numeric) AS in_place_rent,
  (u->>'lease_start')::date AS lease_start,
  (u->>'lease_end')::date AS lease_end,
  u AS unit_data
FROM ${q('uw_documents')} d,
     jsonb_array_elements(
       CASE
         WHEN jsonb_typeof(d.envelope->'sections'->'rent_roll'->'content'->'units') = 'array'
         THEN d.envelope->'sections'->'rent_roll'->'content'->'units'
         ELSE '[]'::jsonb
       END
     ) AS u;`);
  }

  // ─── INSERT Statements ───────────────────────────────────────────────────
  if (includeInserts) {
    const fm = envelope.frontmatter;
    const qm = (fm.quick_metrics ?? {}) as Record<string, unknown>;
    const digest = envelope.semantic_digest;
    const dealId = (fm.deal_id as string | undefined) ?? null;
    const dealName = (fm.deal_name as string | undefined) ?? null;
    const assetClass = (fm.asset_class as string | undefined) ?? null;
    const dealStage = (fm.deal_stage as string | undefined) ?? null;

    if (dialect === 'postgres') {
      // Insert into uw_documents
      statements.push(`INSERT INTO ${q('uw_documents')} (
  semantic_digest, deal_id, deal_name, asset_class, deal_stage, envelope
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlString(dealName)},
  ${sqlString(assetClass)},
  ${sqlString(dealStage)},
  ${sqlJson(envelope, dialect)}
)
ON CONFLICT (semantic_digest) DO UPDATE SET
  deal_id = EXCLUDED.deal_id,
  deal_name = EXCLUDED.deal_name,
  asset_class = EXCLUDED.asset_class,
  deal_stage = EXCLUDED.deal_stage,
  envelope = EXCLUDED.envelope,
  loaded_at = now();`);

      // Insert sections into uw_deal_sections
      for (const [sectionId, entry] of Object.entries(envelope.sections)) {
        if (isBlock(entry)) {
          statements.push(`INSERT INTO ${q('uw_deal_sections')} (
  semantic_digest, section_id, variant, content, meta
) VALUES (
  ${sqlString(digest)},
  ${sqlString(sectionId)},
  'default',
  ${sqlJson(entry.content, dialect)},
  ${sqlJson(entry.content['_meta'], dialect)}
)
ON CONFLICT (semantic_digest, section_id, variant) DO UPDATE SET
  content = EXCLUDED.content,
  meta = EXCLUDED.meta;`);
        } else if (typeof entry === 'object' && entry !== null) {
          for (const [variant, block] of Object.entries(entry as Record<string, UWEnvelopeBlock>)) {
            if (isBlock(block)) {
              statements.push(`INSERT INTO ${q('uw_deal_sections')} (
  semantic_digest, section_id, variant, content, meta
) VALUES (
  ${sqlString(digest)},
  ${sqlString(sectionId)},
  ${sqlString(variant)},
  ${sqlJson(block.content, dialect)},
  ${sqlJson(block.content['_meta'], dialect)}
)
ON CONFLICT (semantic_digest, section_id, variant) DO UPDATE SET
  content = EXCLUDED.content,
  meta = EXCLUDED.meta;`);
            }
          }
        }
      }

      // Insert extracted valuation
      const valBlock = getSectionBlock(envelope, 'valuation');
      if (valBlock) {
        const c = valBlock.content;
        const purchasePrice =
          (c['purchase_price'] as number | undefined) ??
          (qm['purchase_price'] as number | undefined) ??
          null;
        const purchasePriceUnit = (c['purchase_price_per_unit'] as number | undefined) ?? null;
        const purchasePriceSqft = (c['purchase_price_per_sqft'] as number | undefined) ?? null;
        const capRate =
          (c['cap_rate_in_place'] as number | undefined) ??
          (c['cap_rate'] as number | undefined) ??
          (qm['cap_rate'] as number | undefined) ??
          null;
        const targetIrr =
          (c['target_irr'] as number | undefined) ??
          (c['irr'] as number | undefined) ??
          (qm['irr_projected'] as number | undefined) ??
          null;
        const exitCap = (c['exit_cap_rate'] as number | undefined) ?? null;
        const appraisedVal = (c['appraised_value'] as number | undefined) ?? null;

        statements.push(`INSERT INTO ${q('uw_section_valuation')} (
  semantic_digest, deal_id, purchase_price, purchase_price_per_unit, purchase_price_per_sqft,
  cap_rate_in_place, target_irr, exit_cap_rate, appraised_value, valuation_data
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlNumber(purchasePrice)},
  ${sqlNumber(purchasePriceUnit)},
  ${sqlNumber(purchasePriceSqft)},
  ${sqlNumber(capRate)},
  ${sqlNumber(targetIrr)},
  ${sqlNumber(exitCap)},
  ${sqlNumber(appraisedVal)},
  ${sqlJson(c, dialect)}
)
ON CONFLICT (semantic_digest) DO UPDATE SET
  deal_id = EXCLUDED.deal_id,
  purchase_price = EXCLUDED.purchase_price,
  purchase_price_per_unit = EXCLUDED.purchase_price_per_unit,
  purchase_price_per_sqft = EXCLUDED.purchase_price_per_sqft,
  cap_rate_in_place = EXCLUDED.cap_rate_in_place,
  target_irr = EXCLUDED.target_irr,
  exit_cap_rate = EXCLUDED.exit_cap_rate,
  appraised_value = EXCLUDED.appraised_value,
  valuation_data = EXCLUDED.valuation_data;`);
      }

      // Insert extracted debt
      const debtBlock =
        getSectionBlock(envelope, 'debt_structure') ?? getSectionBlock(envelope, 'debt');
      if (debtBlock) {
        const c = debtBlock.content;
        const loanAmount =
          (c['loan_amount'] as number | undefined) ??
          (qm['loan_amount'] as number | undefined) ??
          null;
        const interestRate = (c['interest_rate'] as number | undefined) ?? null;
        const amortMonths =
          (c['amortization_months'] as number | undefined) ??
          (typeof c['amortization_years'] === 'number' ? c['amortization_years'] * 12 : null);
        const termMonths =
          (c['loan_term_months'] as number | undefined) ??
          (typeof c['loan_term_years'] === 'number' ? c['loan_term_years'] * 12 : null);
        const annualDebtService = (c['annual_debt_service'] as number | undefined) ?? null;
        const monthlyDebtService = (c['monthly_debt_service'] as number | undefined) ?? null;

        statements.push(`INSERT INTO ${q('uw_section_debt')} (
  semantic_digest, deal_id, loan_amount, interest_rate, amortization_months,
  term_months, annual_debt_service, monthly_debt_service, debt_data
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlNumber(loanAmount)},
  ${sqlNumber(interestRate)},
  ${sqlNumber(amortMonths)},
  ${sqlNumber(termMonths)},
  ${sqlNumber(annualDebtService)},
  ${sqlNumber(monthlyDebtService)},
  ${sqlJson(c, dialect)}
)
ON CONFLICT (semantic_digest) DO UPDATE SET
  deal_id = EXCLUDED.deal_id,
  loan_amount = EXCLUDED.loan_amount,
  interest_rate = EXCLUDED.interest_rate,
  amortization_months = EXCLUDED.amortization_months,
  term_months = EXCLUDED.term_months,
  annual_debt_service = EXCLUDED.annual_debt_service,
  monthly_debt_service = EXCLUDED.monthly_debt_service,
  debt_data = EXCLUDED.debt_data;`);
      }

      // Insert extracted rent roll
      const rrBlock = getSectionBlock(envelope, 'rent_roll');
      if (rrBlock) {
        const c = rrBlock.content;
        const totalUnits = (c['total_units'] as number | undefined) ?? null;
        const occUnits = (c['occupied_units'] as number | undefined) ?? null;
        const vacUnits = (c['vacant_units'] as number | undefined) ?? null;
        const physOcc = (c['physical_occupancy_pct'] as number | undefined) ?? null;
        const gprMonthly = (c['gross_potential_rent_monthly'] as number | undefined) ?? null;
        const inPlaceRent = (c['in_place_rent_monthly'] as number | undefined) ?? null;

        statements.push(`INSERT INTO ${q('uw_section_rent_roll_summary')} (
  semantic_digest, deal_id, total_units, occupied_units, vacant_units,
  physical_occupancy_pct, gross_potential_rent_monthly, in_place_rent_monthly, rent_roll_data
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlNumber(totalUnits)},
  ${sqlNumber(occUnits)},
  ${sqlNumber(vacUnits)},
  ${sqlNumber(physOcc)},
  ${sqlNumber(gprMonthly)},
  ${sqlNumber(inPlaceRent)},
  ${sqlJson(c, dialect)}
)
ON CONFLICT (semantic_digest) DO UPDATE SET
  deal_id = EXCLUDED.deal_id,
  total_units = EXCLUDED.total_units,
  occupied_units = EXCLUDED.occupied_units,
  vacant_units = EXCLUDED.vacant_units,
  physical_occupancy_pct = EXCLUDED.physical_occupancy_pct,
  gross_potential_rent_monthly = EXCLUDED.gross_potential_rent_monthly,
  in_place_rent_monthly = EXCLUDED.in_place_rent_monthly,
  rent_roll_data = EXCLUDED.rent_roll_data;`);

        const units = c['units'];
        if (Array.isArray(units) && units.length > 0) {
          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (typeof u === 'object' && u !== null) {
              const unitObj = u as Record<string, unknown>;
              const unitId = String(
                unitObj['unit_id'] ?? unitObj['unit'] ?? unitObj['id'] ?? i + 1,
              );
              const tenantName = (unitObj['tenant_name'] ?? unitObj['tenant'] ?? null) as
                | string
                | null;
              const sqft = (unitObj['square_feet'] ??
                unitObj['sqft'] ??
                unitObj['sf'] ??
                null) as number | null;
              const rent = (unitObj['in_place_rent'] ??
                unitObj['monthly_rent'] ??
                unitObj['rent'] ??
                null) as number | null;
              const leaseStart = (unitObj['lease_start'] as string | undefined) ?? null;
              const leaseEnd = (unitObj['lease_end'] as string | undefined) ?? null;

              statements.push(`INSERT INTO ${q('uw_section_rent_roll')} (
  semantic_digest, deal_id, unit_id, tenant_name, square_feet, in_place_rent, lease_start, lease_end, unit_data
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlString(unitId)},
  ${sqlString(tenantName)},
  ${sqlNumber(sqft)},
  ${sqlNumber(rent)},
  ${sqlDate(leaseStart, dialect)},
  ${sqlDate(leaseEnd, dialect)},
  ${sqlJson(unitObj, dialect)}
)
ON CONFLICT (semantic_digest, unit_id) DO UPDATE SET
  deal_id = EXCLUDED.deal_id,
  tenant_name = EXCLUDED.tenant_name,
  square_feet = EXCLUDED.square_feet,
  in_place_rent = EXCLUDED.in_place_rent,
  lease_start = EXCLUDED.lease_start,
  lease_end = EXCLUDED.lease_end,
  unit_data = EXCLUDED.unit_data;`);
            }
          }
        }
      }
    } else {
      // Snowflake MERGE / INSERT statements
      statements.push(`MERGE INTO ${q('uw_documents')} t
USING (SELECT ${sqlString(digest)} AS semantic_digest) s
ON t.semantic_digest = s.semantic_digest
WHEN MATCHED THEN UPDATE SET
  deal_id = ${sqlString(dealId)},
  deal_name = ${sqlString(dealName)},
  asset_class = ${sqlString(assetClass)},
  deal_stage = ${sqlString(dealStage)},
  envelope = ${sqlJson(envelope, dialect)},
  loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  semantic_digest, deal_id, deal_name, asset_class, deal_stage, envelope
) VALUES (
  ${sqlString(digest)},
  ${sqlString(dealId)},
  ${sqlString(dealName)},
  ${sqlString(assetClass)},
  ${sqlString(dealStage)},
  ${sqlJson(envelope, dialect)}
);`);
    }
  }

  return statements;
}

/**
 * Returns a complete SQL script string for ingesting a UWMD document.
 */
export function exportSql(envelope: UWDocumentEnvelope, options: ExportSqlOptions = {}): string {
  const statements = exportSqlStatements(envelope, options);
  const header = [
    '--',
    '-- UW Markdown SQL Lake Export (RFC 0049 / Relational Projection)',
    `-- Digest: ${envelope.semantic_digest ?? 'none'}`,
    `-- Deal:   ${envelope.frontmatter.deal_name ?? envelope.frontmatter.deal_id ?? 'untitled'}`,
    `-- Date:   ${new Date().toISOString()}`,
    '--',
    '',
  ].join('\n');

  return `${header}${statements.join('\n\n')}\n`;
}
