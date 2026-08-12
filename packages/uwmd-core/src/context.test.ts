import { describe, expect, it } from 'vitest';
import {
  BANCROFT_LAYERS,
  buildAgentContext,
  buildAgentPrompt,
  getLayerDependencies,
  isContextReady,
} from './context.js';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from './parser.js';

describe('agent context helpers', () => {
  const parsed = parseUWFile(generateBlankUWFile({ dealId: 'uw_2026_CONTEXT' }));

  it('uses the L7 fallback for unknown agent identifiers and exposes every section', () => {
    const context = buildAgentContext(parsed, 'custom-agent');

    expect(context.layer.id).toBe('L7');
    expect(Object.keys(context.sections)).toEqual(Object.keys(parsed.sections));
    expect(context.profileContext.profile).toBe('live');
    expect(isContextReady(context)).toBe(true);
  });

  it('builds an actionable prompt with custom instructions', () => {
    const prompt = buildAgentPrompt(buildAgentContext(parsed, 'L1-01'), 'Focus on sponsor strength.');

    expect(prompt.systemPrompt).toContain('L1 — Screening');
    expect(prompt.systemPrompt).toContain('screening, preliminary_sizing');
    expect(prompt.userMessage).toContain('Focus on sponsor strength.');
    expect(prompt.outputSchemaDescription).toContain('max_loan_amount');
  });

  it('publishes the dependency graph and profile contract for every layer', () => {
    expect(getLayerDependencies('L6')).toEqual(['L2', 'L4', 'L5']);
    expect(getLayerDependencies('unknown')).toEqual([]);
    expect(BANCROFT_LAYERS.map(layer => layer.consumed_profile)).toEqual([
      'summary', 'summary', 'compact', 'summary', 'relevant', 'relevant', 'relevant', 'relevant', 'live',
    ]);
  });
});
