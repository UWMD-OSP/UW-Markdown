// Retained independent probes; production import/parsed-entry/output paths and async API adaptation only.
// Synchronous model hash facade is documented in ../model.mjs; actual async stamps are separately tested.
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/', import.meta.url), { recursive: true });
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectSource, preimage, digest } from '../model.mjs';
// No candidate parser, projector, canonicalizer or frozen expectation is used to derive these values.
export const canon = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
export const sha = s => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`;
export function oracle(source) {
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    assert.ok(header);
    const frontmatter = {};
    for (const line of header[1].split(/\r?\n/)) {
        const [_, key, text] = /^([^:]+):\s*(.*)$/.exec(line);
        frontmatter[key] = JSON.parse(text);
    }
    const model = { envelope_version: '2.0', format_version: '3.0', frontmatter, sections: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {} };
    const blocks = [];
    const body = source.slice(header[0].length);
    let end = 0;
    for (const match of body.matchAll(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm)) {
        const annotation = { section: match[1] };
        for (const tok of match[2].trim().split(/\s+/).filter(Boolean)) {
            const i = tok.indexOf('=');
            const k = tok.slice(0, i);
            const v = tok.slice(i + 1);
            annotation[k] = k === 'v' ? Number(v) : k === 'superseded' ? v === 'true' : v;
        }
        const prose = body.slice(end, match.index).trim();
        end = match.index + match[0].length;
        blocks.push({ annotation, content: JSON.parse(match[3]), ...(prose ? { prose } : {}) });
    }
    const dead = b => b.annotation.superseded === true || b.content._meta?.lifecycle?.superseded === true;
    const ids = [...new Set(blocks.map(b => b.annotation.section))];
    const append = ['pipeline_log', 'custom_calculations', 'custom_scenarios'];
    const parallel = ['operating_statement', 'stress_tests', 'due_diligence', 'lease_up_schedule', 'cash_flow_series', 'distribution_waterfall', 'reserve_accounts'];
    for (const id of ids) {
        const rows = blocks.filter(b => b.annotation.section === id);
        if (append.includes(id)) {
            model[id] = rows;
            continue;
        }
        const active = rows.filter(b => !dead(b));
        const optin = active.some(b => Object.hasOwn(b.content, '_role')) && active.some(b => Object.hasOwn(b.annotation, 'variant'));
        const isExtension = id.startsWith('x_');
        const isParallel = !isExtension && parallel.includes(id) || optin;
        const selected = new Map();
        const history = [];
        for (const b of rows) {
            if (dead(b))
                history.push(b);
            else {
                const key = isParallel ? (isExtension ? b.annotation.variant ?? null : b.annotation.variant ?? 'default') : null;
                if (selected.has(key))
                    history.push(selected.get(key));
                selected.set(key, b);
            }
        }
        if (history.length)
            model.superseded[id] = history;
        if (!selected.size)
            continue;
        if (isExtension)
            model.extensions[id] = isParallel ? { mode: 'variants', blocks: [...selected].sort(([a], [b]) => a === null ? -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0).map(([variant, block]) => ({ variant, block })) } : { mode: 'single', block: selected.get(null) };
        else
            model.sections[id] = isParallel ? Object.fromEntries(selected) : selected.get(null);
    }
    return { model, blocks };
}
const packet = JSON.parse(fs.readFileSync(new URL('../../cases.json', import.meta.url), 'utf8'));
const records = [];
for (const item of packet.source_cases) {
    const { model, blocks } = oracle(item.source);
    const expected_preimage = canon(model);
    const expected_digest = sha(expected_preimage);
    const actual = projectSource(item.source);
    const full = structuredClone(model);
    full.generated_at = '2000-01-01T00:00:00Z';
    full.generator = 'candidate';
    records.push({ name: item.name, physical_count: blocks.length, expected_model: full, expected_preimage, expected_digest,
        candidate_equal: canon(actual.model) === canon(full) && preimage(actual.model) === expected_preimage && digest(actual.model) === expected_digest,
        builder_expected_equal: canon(item.expected_model) === canon(full) && item.expected_preimage === expected_preimage && item.expected_digest === expected_digest });
}
fs.writeFileSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/independent-source-oracles.json', import.meta.url), JSON.stringify({ method: 'raw synthetic fenced JSON plus restricted header observer; D1/D2 event routing; recursive sorted JSON and node:crypto, no candidate parser/JCS/freezer', records }, null, 2));
console.log(JSON.stringify(records.map(({ name, physical_count, candidate_equal, builder_expected_equal }) => ({ name, physical_count, candidate_equal, builder_expected_equal })), null, 2));
