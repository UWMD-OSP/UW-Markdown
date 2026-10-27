// Shared contributor guidance has one source and import-only entry points.
export function agentGuidanceFailures(agents, claude, tools = '') {
  const failures = [];
  if (!agents.trim()) failures.push('AGENTS.md: shared guidance is empty.');
  if (claude.trim() !== '@AGENTS.md') failures.push('CLAUDE.md: must contain only @AGENTS.md.');
  if (tools.trim() !== '@../AGENTS.md') failures.push('tools/CLAUDE.md: must contain only @../AGENTS.md.');
  return failures;
}
