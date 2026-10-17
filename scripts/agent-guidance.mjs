// The owner explicitly requires this one policy block in both entry points.
export function agentGuidanceFailures(agents, claude) {
  const failures = [];
  const pattern = /<!-- owner-rule:start -->\r?\n[\s\S]*?\r?\n<!-- owner-rule:end -->/g;
  const blocks = [agents, claude].map(text => [...text.matchAll(pattern)]);
  for (const [i, name] of ['AGENTS.md', 'CLAUDE.md'].entries()) {
    if (blocks[i].length !== 1 || blocks[i][0].index > 100) failures.push(`${name}: needs exactly one owner-rule block near the top.`);
  }
  if (blocks.every(matches => matches.length === 1)
    && blocks[0][0][0].replaceAll('\r\n', '\n') !== blocks[1][0][0].replaceAll('\r\n', '\n')) {
    failures.push('CLAUDE.md: owner-rule block differs from AGENTS.md.');
  }
  const pointer = claude.replace(pattern, '');
  if (!/^@AGENTS\.md\s*$/m.test(pointer)) failures.push('CLAUDE.md: must import @AGENTS.md.');
  const lines = pointer.split('\n').filter(line => line.trim() && !line.startsWith('# '));
  if (/^#{2,} /m.test(pointer) || lines.length > 8) failures.push('CLAUDE.md: only the matching owner rule and shared-guidance pointer are allowed.');
  return failures;
}
