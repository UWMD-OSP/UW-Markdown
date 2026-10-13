// The editor's own version, read from its package.json at build time so the
// footer and the receipt issuer never drift from the manifest.
import { name, version } from '../package.json';

export const EDITOR_PACKAGE = name;
export const EDITOR_VERSION = version;
