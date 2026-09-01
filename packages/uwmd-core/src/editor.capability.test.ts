// Capability gate — the RFC 0011 editor hook (Protocol §XIV), tested with a
// stub verifier. The crypto (JWT decode, signatures) lives in @uwmd/signing
// and is tested there; what core owns is the gate: token required when a
// verifier is configured, the edit context handed to it, the jti note, the
// POL-03 refusal, the sync-path refusal, and the never-escalates ordering
// against the static §V.3 policy check.

import { describe, expect, it } from 'vitest';
import { applyEdit, applyEditAsync } from './editor.js';
import type { EditContext } from './editor.js';
import { parseUWFile, getSection } from './parser.js';
import type {
  CapabilityVerdict,
  CapabilityVerifier,
  CapabilityVerifyContext,
  EditOperation,
} from './protocol.js';

const FILE = `---
uw_version: "1.1"
deal_id: "DEAL-CAP-01"
deal_name: "Capability Gate Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
asset_class: multifamily
deal_stage: screening
status: draft
created_by: wizard
---

# Capability Gate Deal

\`\`\`json uw:section=noi_model source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "net_operating_income": 480000
}
\`\`\`

\`\`\`json uw:section=pipeline_log source=system/uwmd ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": []
}
\`\`\`
`;

const OP: EditOperation = {
  kind: 'section_supersede',
  section_id: 'noi_model',
  content: { net_operating_income: 495000 },
  meta: {},
};

const CTX: EditContext = {
  actor: 'agent instance A',
  source: 'agent/L2.inst-A',
  capability_token: 'the-token',
};

function accepting(seen: CapabilityVerifyContext[] = []): CapabilityVerifier {
  return {
    async verify(_token, ctx) {
      seen.push(ctx);
      return { ok: true, sub: ctx.source, jti: 'JTI-123' };
    },
  };
}

function rejecting(reason: 'expired' | 'wrong_section'): CapabilityVerifier {
  return { async verify(): Promise<CapabilityVerdict> { return { ok: false, reason }; } };
}

describe('the sync path with a verifier configured', () => {
  it('refuses rather than silently skipping the check', () => {
    const parsed = parseUWFile(FILE);
    const result = applyEdit(FILE, parsed, OP, CTX, undefined, { capabilityVerifier: accepting() });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-008');
  });
});

describe('the async gate', () => {
  it('accepts an in-scope token and records the jti in the new block notes', async () => {
    const parsed = parseUWFile(FILE);
    const result = await applyEditAsync(FILE, parsed, OP, CTX, undefined, {
      capabilityVerifier: accepting(),
    });
    expect(result.ok).toBe(true);
    const head = getSection(parseUWFile(result.content!), 'noi_model');
    expect(head?.meta.notes).toBe('capability:JTI-123');
  });

  it('appends the jti to existing notes rather than replacing them', async () => {
    const parsed = parseUWFile(FILE);
    const result = await applyEditAsync(FILE, parsed, OP, { ...CTX, notes: 'per call' }, undefined, {
      capabilityVerifier: accepting(),
    });
    const head = getSection(parseUWFile(result.content!), 'noi_model');
    expect(head?.meta.notes).toBe('per call; capability:JTI-123');
  });

  it('hands the verifier the deal, section, stage, op, and source', async () => {
    const seen: CapabilityVerifyContext[] = [];
    const parsed = parseUWFile(FILE);
    await applyEditAsync(FILE, parsed, OP, CTX, undefined, { capabilityVerifier: accepting(seen) });
    expect(seen).toEqual([{
      deal_id: 'DEAL-CAP-01',
      section: 'noi_model',
      stage: 'screening',
      op: 'section_supersede',
      source: 'agent/L2.inst-A',
    }]);
  });

  it('names _frontmatter for frontmatter ops', async () => {
    const seen: CapabilityVerifyContext[] = [];
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'status', value: 'under_review' };
    await applyEditAsync(FILE, parsed, op, CTX, undefined, { capabilityVerifier: accepting(seen) });
    expect(seen[0]!.section).toBe('_frontmatter');
    expect(seen[0]!.op).toBe('frontmatter_set');
  });

  it('rejects a missing token with POL-03', async () => {
    const parsed = parseUWFile(FILE);
    const { capability_token: _omit, ...bare } = CTX;
    const result = await applyEditAsync(FILE, parsed, OP, bare, undefined, {
      capabilityVerifier: accepting(),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('POL-03');
  });

  it('rejects a refused token with POL-03 carrying the reason', async () => {
    const parsed = parseUWFile(FILE);
    const result = await applyEditAsync(FILE, parsed, OP, CTX, undefined, {
      capabilityVerifier: rejecting('expired'),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('POL-03');
    expect(result.error?.message).toContain('expired');
  });

  it('never escalates: an accepted token does not override the static §V.3 refusal', async () => {
    // pipeline_log's head is system/*-sourced; an agent write into a
    // system_only section is refused by checkAuthority no matter what the
    // token says.
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'pipeline_log',
      content: { entries: [] },
      meta: {},
    };
    const result = await applyEditAsync(FILE, parsed, op, CTX, undefined, {
      capabilityVerifier: accepting(),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).not.toBe('POL-03'); // the static refusal, not the token
  });

  it('behaves exactly as before when no verifier is configured', async () => {
    const parsed = parseUWFile(FILE);
    const result = await applyEditAsync(FILE, parsed, OP, CTX);
    expect(result.ok).toBe(true);
    const head = getSection(parseUWFile(result.content!), 'noi_model');
    expect(head?.meta.notes).toBeNull();
  });
});
