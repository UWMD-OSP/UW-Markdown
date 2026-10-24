// Actual production modules. No generated forks or runtime rewriting.
import * as parser from '../../packages/uwmd-verify/dist/parser.js';
import * as envelope from '../../packages/uwmd-verify/dist/envelope.js';
import * as receipts from '../../packages/uwmd-verify/dist/receipts.js';
import * as signing from '../../packages/uwmd-verify/dist/document-signatures.js';
import * as integrity from '../../packages/uwmd-verify/dist/integrity.js';
import * as reserves from '../../packages/uwmd-verify/dist/reserve-draw-bindings.js';
import * as propertyCash from '../../packages/uwmd-verify/dist/property-cash-flows.js';
export const production={parser,envelope,receipts,signing,integrity,reserves,propertyCash};
