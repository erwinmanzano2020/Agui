import type { NextApiRequest, NextApiResponse } from 'next';
import { computeDailyPay } from '@/lib/payroll/compute';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { totalMinutes, ruleMode, rateType, rateValue } = req.body || {};
  const result = computeDailyPay(Number(totalMinutes), ruleMode, rateType, Number(rateValue));
  res.status(200).json(result);
}