// Unaccepted RFC0089 minimum only; intentionally no full-model admission.
import { readFileSync } from 'node:fs';
import { extensionMinimum, historyMinimum } from '../decision-proof/projection.mjs';
const models = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(models.map(model => ({
  extensions: extensionMinimum(model.extensions),
  superseded: historyMinimum(model.superseded),
}))));
