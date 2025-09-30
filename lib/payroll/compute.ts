import { RULES, RuleMode } from './rules';

export function splitRegularOT(totalMinutes: number, ruleMode: RuleMode) {
  const limit = RULES[ruleMode].regularMinutes;
  const regular = Math.min(totalMinutes, limit);
  const ot = Math.max(0, totalMinutes - limit);
  return { regular, ot };
}

export function computeDailyPay(
  totalMinutes: number,
  ruleMode: RuleMode,
  rateType: 'daily' | 'hourly',
  rateValue: number
) {
  const { regular, ot } = splitRegularOT(totalMinutes, ruleMode);
  const hourly = rateType === 'hourly' ? rateValue : rateValue / (RULES[ruleMode].regularMinutes / 60);
  const regularPay = (regular / 60) * hourly;
  const otPay = (ot / 60) * hourly * 1; // simple OT multiplier placeholder
  const gross = +(regularPay + otPay).toFixed(2);
  return { regular, ot, hourly, regularPay: +regularPay.toFixed(2), otPay: +otPay.toFixed(2), gross };
}