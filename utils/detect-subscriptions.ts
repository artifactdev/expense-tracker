import { BillingPeriod } from '@/types/subscriptions';

export interface DetectedSubscriptionCandidate {
  name: string;
  normalizedName: string;
  amount: number; // always positive (abs)
  billingPeriod: BillingPeriod;
  occurrences: number;
  lastDate: string; // yyyy-MM-dd
  transactionIds: string[];
}

type RawTransaction = {
  id: string;
  name: string;
  amount: number;
  date: string; // yyyy-MM-dd
};

// Expected day-spreads for each billing period (±25% tolerance)
const PERIOD_RANGES: { period: BillingPeriod; min: number; max: number }[] = [
  { period: BillingPeriod.Monthly, min: 22, max: 40 },
  { period: BillingPeriod.BiMonthly, min: 45, max: 75 },
  { period: BillingPeriod.Quarterly, min: 80, max: 115 },
  { period: BillingPeriod.SemiAnnually, min: 160, max: 210 },
  { period: BillingPeriod.Annually, min: 330, max: 400 },
  { period: BillingPeriod.Biennially, min: 690, max: 760 },
];

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86_400_000;
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay);
};

const detectBillingPeriod = (gaps: number[]): BillingPeriod | null => {
  if (gaps.length === 0) return null;
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  for (const { period, min, max } of PERIOD_RANGES) {
    if (avgGap >= min && avgGap <= max) return period;
  }
  return null;
};

const amountsSimilar = (a: number, b: number): boolean => {
  const diff = Math.abs(Math.abs(a) - Math.abs(b));
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base === 0 ? true : diff / base <= 0.05; // ±5%
};

export const detectSubscriptions = (
  transactions: RawTransaction[]
): DetectedSubscriptionCandidate[] => {
  // Only look at expenses (negative amounts)
  const expenses = transactions.filter(t => t.amount < 0);

  // Group by normalized name
  const groups = new Map<string, RawTransaction[]>();
  for (const tx of expenses) {
    const key = normalizeName(tx.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const candidates: DetectedSubscriptionCandidate[] = [];

  for (const [normalizedName, txs] of groups) {
    if (txs.length < 2) continue;

    // Sub-group by similar amounts
    const processed = new Set<string>();
    for (const anchor of txs) {
      if (processed.has(anchor.id)) continue;
      const group = txs.filter(t => amountsSimilar(anchor.amount, t.amount));
      if (group.length < 2) continue;
      group.forEach(t => processed.add(t.id));

      // Sort by date ascending
      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));

      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
      }

      const billingPeriod = detectBillingPeriod(gaps);
      if (!billingPeriod) continue;

      const avgAmount = group.reduce((sum, t) => sum + Math.abs(t.amount), 0) / group.length;

      candidates.push({
        name: sorted[sorted.length - 1].name, // use latest occurrence as display name
        normalizedName,
        amount: Math.round(avgAmount * 100) / 100,
        billingPeriod,
        occurrences: group.length,
        lastDate: sorted[sorted.length - 1].date,
        transactionIds: sorted.map(t => t.id),
      });
      break; // one candidate per normalized name
    }
  }

  // Sort by occurrences desc
  return candidates.sort((a, b) => b.occurrences - a.occurrences);
};
