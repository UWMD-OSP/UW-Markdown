import { evaluateCalc, getPackForAssetClass, type ParsedUWFile, type CalcEvaluationContext } from '@uwmd/verify';

/** Display missing summaries through existing deterministic packs; never write facts. */
export function resolveRenderMetrics(parsed: ParsedUWFile): Record<string, unknown> {
  const metrics: Record<string, unknown> = { ...parsed.frontmatter.quick_metrics };
  const context: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };
  const facts = {
    purchase_price: 'valuation.purchase_price', loan_amount: 'debt_structure.loan_amount',
    equity_required: 'sources_uses.equity_metrics.equity_total', noi_underwritten: 'noi_model.net_operating_income',
  };
  for (const [id, formula] of Object.entries(facts)) {
    if (Object.hasOwn(metrics, id)) continue;
    const result = evaluateCalc({ id, formula, unit: '$' }, context);
    if (result.ok) metrics[id] = result.value;
  }
  const pack = getPackForAssetClass(parsed.frontmatter.asset_class);
  for (const calculation of pack?.calculations ?? []) {
    const result = evaluateCalc(calculation, context);
    context.prior_results[calculation.id] = result.ok ? result.value : null;
    if (!Object.hasOwn(metrics, calculation.id) && result.ok) metrics[calculation.id] = result.value;
  }
  return metrics;
}
