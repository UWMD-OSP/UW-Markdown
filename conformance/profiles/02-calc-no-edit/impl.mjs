// The shape the first external adopter actually has: a complete calc engine and
// no edit engine. Cumulative tiers cannot express it — §II.5 capabilities can.
import { runStub } from '../stub.mjs';
runStub(['parse', 'validate', 'render-summary', 'render-chat', 'calc-evaluate']);
