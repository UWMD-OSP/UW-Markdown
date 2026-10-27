// RFC0129 package admission: verify and snapshot bytes before reading facts.
import { snapshotJSONValue } from './json-admission.js';
import { assertUWDealPackageManifest } from './deal-package.js';
import { verifyUWDealPackage, type UWDealPackageDecoded } from './deal-package-zip.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import { DocumentFactsError, isDocumentFactsProfile, parseDocumentFactsUWX, type DocumentFactsSourceInventory } from './document-facts.js';

export async function readDocumentFactsPackage(
  input: UWDealPackageDecoded,
  memberId: string,
  conflictingSourceIds: readonly string[],
) {
  const manifest = assertUWDealPackageManifest(snapshotJSONValue(input.manifest));
  const payloads: Record<string, Uint8Array> = {};
  for (const member of manifest.members) {
    const property = Object.getOwnPropertyDescriptor(input.payloads, member.path);
    if (!property || !Object.hasOwn(property, 'value') || !(property.value instanceof Uint8Array)) throw new DocumentFactsError('DF-013', 'Every declared package member must have data bytes.');
    Object.defineProperty(payloads, member.path, { value: property.value.slice(), enumerable: true });
  }
  const inventory: DocumentFactsSourceInventory = { source_ids: manifest.members.map(m => m.id), conflicting_source_ids: [...conflictingSourceIds] };
  const decoded = { manifest, payloads };
  const verification = await verifyUWDealPackage(decoded, {
    semanticDigestOf: async (_id, bytes) => {
      try { return await computeEnvelopeDigest(toUWEnvelope(parseUWFile(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))); }
      catch { return null; }
    },
  });
  if (verification.status !== 'verified') throw new DocumentFactsError(verification.errors[0]?.code ?? 'DF-013', 'Package byte/semantic verification must complete before fact admission.');
  const documents = new Map<string, ReturnType<typeof parseDocumentFactsUWX>>();
  for (const member of manifest.members) {
    if (!isDocumentFactsProfile(member.document_profile)) continue;
    let source: string;
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(payloads[member.path]); }
    catch { throw new DocumentFactsError('DF-013', 'Fact members must be UTF-8 UWX.'); }
    const parsed = parseDocumentFactsUWX(source, inventory);
    if (parsed.profile !== member.document_profile) throw new DocumentFactsError('DF-011', 'Package descriptor and document profile disagree.');
    documents.set(member.id, parsed);
  }
  for (const [id, entry] of documents) {
    if (entry.document.supersedes === undefined) continue;
    const prior = (manifest.links ?? []).filter(link => link.from === id && link.type === 'supersedes')
      .some(link => documents.get(link.to)?.document.document_id === entry.document.supersedes);
    if (!prior) throw new DocumentFactsError('DF-014', 'A superseding fact document must retain and link its prior document and governing source history.');
  }
  const selected = documents.get(memberId);
  if (!selected) throw new DocumentFactsError('DF-001', 'Select an explicit implemented fact member.');
  return { ...selected, source_inventory: inventory, verification };
}
