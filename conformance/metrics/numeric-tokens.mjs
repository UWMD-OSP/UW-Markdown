// Fixture source addresses retain precision that JSON.parse discards. The
// token readers are part of `verifyStatedMetrics` (RFC 0083 §2); the controls
// exercise them through this path.
export { jsonNumericTokens, jsonStatedDecimals, quickMetricDecimals } from '../../packages/uwmd-core/dist/metric-verification.js';
