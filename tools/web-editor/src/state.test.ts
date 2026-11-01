// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateBlankUWFile } from '@uwmd/core/browser';
import { useDeal } from './state.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('new deal rename', () => {
  it('updates the generated heading and both download names through undo and redo', () => {
    const { result } = renderHook(useDeal);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
    act(() => result.current[1].newDeal({ dealName: 'Untitled Deal' }));
    const original = result.current[0].loaded!.source;
    const originalLog = result.current[0].loaded!.parsed.sections.pipeline_log;
    act(() => result.current[1].applyOp({ kind: 'frontmatter_set', path: 'deal_name', value: 'Synthetic QA' }));
    expect(result.current[0].loaded!.source).toContain('\n# Synthetic QA\n');
    expect(result.current[0].loaded!.source).not.toContain('\n# Untitled Deal\n');
    expect(result.current[0].filename).toBe('synthetic-qa.uwx.md');
    // Creation history is historical; renaming must leave it untouched.
    expect(result.current[0].loaded!.parsed.sections.pipeline_log).toEqual(originalLog);
    act(() => result.current[1].downloadUWX());
    expect((click.mock.instances.at(-1) as HTMLAnchorElement).download).toBe('synthetic-qa.uwx.md');
    act(() => { result.current[1].downloadLite(); });
    expect((click.mock.instances.at(-1) as HTMLAnchorElement).download).toBe('synthetic-qa.uw.md');
    act(() => result.current[1].undo());
    expect(result.current[0].loaded!.source).toBe(original);
    expect(result.current[0].filename).toBe('untitled-deal.uwx.md');
    act(() => result.current[1].redo());
    expect(result.current[0].loaded!.source).toContain('\n# Synthetic QA\n');
    expect(result.current[0].filename).toBe('synthetic-qa.uwx.md');
  });

  it('keeps uploaded filenames and authored headings when frontmatter changes', () => {
    const { result } = renderHook(useDeal);
    const source = generateBlankUWFile({ dealName: 'Original' }).replace('# Original\n', '# Authored title\n');
    act(() => result.current[1].loadFile(source, 'review-copy.uwx.md'));
    act(() => result.current[1].applyOp({ kind: 'frontmatter_set', path: 'deal_name', value: 'Renamed' }));
    expect(result.current[0].filename).toBe('review-copy.uwx.md');
    expect(result.current[0].loaded!.source).toContain('\n# Authored title\n');
  });
});
