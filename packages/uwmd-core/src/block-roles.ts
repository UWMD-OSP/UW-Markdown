import type { BlockRole, CrossCheckResolutionEvidence, UWBlock } from './types.js';
import { BLOCK_ROLES, CROSS_CHECK_ROLE_PREFERENCE } from './protocol.js';

export function isBlockRole(value: unknown): value is BlockRole {
  return typeof value === 'string' && (BLOCK_ROLES as readonly string[]).includes(value);
}

export function hasBlockRole(block: UWBlock): boolean {
  return Object.prototype.hasOwnProperty.call(block.content, '_role');
}

export type RoleResolution =
  | { state: 'absent'; block: null }
  | { state: 'resolved'; block: UWBlock; variant?: string; evidence?: CrossCheckResolutionEvidence }
  | { state: 'unresolvable'; block: null; variants: string[]; detail?: string };

/** Property-level reads exclude components and invalid roles before any fallback. */
export function resolveRoleBlock(
  entry: UWBlock | Record<string, UWBlock> | undefined,
  sectionId: string,
  preferred: readonly string[] = [],
  code?: string,
): RoleResolution {
  if (!entry) return { state: 'absent', block: null };
  const single = 'annotation' in entry;
  const candidates: Array<[string | undefined, UWBlock]> = single
    ? [[undefined, entry as UWBlock]] : Object.entries(entry as Record<string, UWBlock>);
  const roleBearing = candidates.some(([, block]) => hasBlockRole(block));
  const eligible = candidates.filter(([, block]) => !hasBlockRole(block)
    || (isBlockRole(block.content['_role']) && block.content['_role'] !== 'component'));
  const resolve = ([variant, block]: [string | undefined, UWBlock], via: CrossCheckResolutionEvidence['via']): RoleResolution => ({
    state: 'resolved', block, ...(variant !== undefined ? { variant } : {}),
    ...(roleBearing ? { evidence: { ...(variant !== undefined ? { variant } : {}), via } } : {}),
  });
  const refuse = (detail?: string): RoleResolution => ({
    state: 'unresolvable', block: null,
    variants: candidates.map(([variant]) => variant ?? '(single)').sort(),
    ...(detail ? { detail } : {}),
  });
  if (single && eligible.length) return resolve(eligible[0]!, 'single');
  for (const key of preferred) {
    const found = eligible.find(([variant]) => variant === key);
    if (found) return resolve(found, 'preference');
  }
  const rolePreference = code ? CROSS_CHECK_ROLE_PREFERENCE[code]?.[sectionId] : undefined;
  for (const role of [...(rolePreference ? [rolePreference] : []), 'primary']) {
    const found = eligible.filter(([, block]) => block.content['_role'] === role);
    if (found.length > 1) return refuse(`multiple variants claim role ${role}: ${found.map(([v]) => v).sort().join(', ')}`);
    if (found.length === 1) return resolve(found[0]!, role === 'primary' ? 'primary' : 'role');
  }
  for (const key of ['default', 'base'] as const) {
    const found = eligible.find(([variant]) => variant === key);
    if (found) return resolve(found, key);
  }
  if (eligible.length === 1) return resolve(eligible[0]!, 'sole');
  return refuse(roleBearing
    ? eligible.length === 0 ? 'no eligible property-level block (component or invalid role)'
      : 'no unique role or preferred/default/base variant among eligible property-level blocks'
    : undefined);
}
