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
  counterparty?: string | null;
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

// Tokens that are noise (references, IDs, dates, etc.)
const NOISE_RE = /\b(ref|nr|id|datum|vom|am|des|ueber|uber|via|pp|paypal)\b/gi;
const NUMERIC_HEAVY_RE = /\b[a-z0-9]*\d{3,}[a-z0-9]*\b/gi; // tokens with 3+ digits

/** Extract a clean grouping key from name + counterparty */
const buildGroupKey = (name: string, counterparty?: string | null): string => {
  // Prefer counterparty if present and meaningful (>2 chars)
  const cp = (counterparty ?? '').trim();
  if (cp.length > 2) {
    return cp.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Fallback: clean the name by stripping noise
  let cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(NUMERIC_HEAVY_RE, '')
    .replace(NOISE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Keep only the first 3 meaningful words (the "brand" part)
  const words = cleaned.split(' ').filter(w => w.length > 1);
  cleaned = words.slice(0, 3).join(' ');
  return cleaned;
};

/** Derive a clean display name from the raw group */
const cleanDisplayName = (name: string, counterparty?: string | null): string => {
  const cp = (counterparty ?? '').trim();
  if (cp.length > 2) return cp;

  // Use the first few meaningful words of the name
  const cleaned = name
    .replace(/[^a-zA-ZäöüÄÖÜß0-9\s.-]/g, ' ')
    .replace(NUMERIC_HEAVY_RE, '')
    .replace(NOISE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(w => w.length > 1);
  return words.slice(0, 4).join(' ') || name.slice(0, 40);
};

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

  // Group by clean key (prefers counterparty, falls back to cleaned name)
  const groups = new Map<string, RawTransaction[]>();
  for (const tx of expenses) {
    const key = buildGroupKey(tx.name, tx.counterparty);
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
      const latest = sorted[sorted.length - 1];

      candidates.push({
        name: cleanDisplayName(latest.name, latest.counterparty),
        normalizedName,
        amount: Math.round(avgAmount * 100) / 100,
        billingPeriod,
        occurrences: group.length,
        lastDate: latest.date,
        transactionIds: sorted.map(t => t.id),
      });
      break; // one candidate per normalized name
    }
  }

  // Sort by occurrences desc
  return candidates.sort((a, b) => b.occurrences - a.occurrences);
};
