/**
 * MCP (Model Context Protocol) HTTP endpoint — pure JSON-RPC 2.0 handler.
 * No @modelcontextprotocol/sdk dependency (avoids zod/v3 subpath conflict).
 */
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { LOCAL_USER_ID } from '@/utils/const';

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------
type RequestId = string | number;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: RequestId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: RequestId | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const ok = (id: RequestId | null | undefined, result: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id: id ?? null,
  result,
});

const rpcErr = (
  id: RequestId | null | undefined,
  code: number,
  message: string
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: 'list_transactions',
    description:
      'List bank transactions with optional filters. Use this to answer questions like "what did I spend last month?", "show me recent transactions", "what did I pay to Amazon?". If no dates are given, defaults to the last 90 days. Returns id, name (description), counterparty (merchant), amount (negative=expense, positive=income), date, categories, account, notes.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date yyyy-MM-dd. Default: 90 days ago.' },
        endDate: { type: 'string', description: 'End date yyyy-MM-dd. Default: today.' },
        category: { type: 'string', description: 'Filter by category name (partial match).' },
        type: {
          type: 'string',
          enum: ['income', 'expense'],
          description: 'Only income or only expenses.',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 500,
          description: 'Max results (default 50).',
        },
        offset: { type: 'number', minimum: 0, description: 'Pagination offset.' },
      },
    },
  },
  {
    name: 'get_balance',
    description:
      'Get overall financial overview: total income, total expenses, net balance, and per-category breakdown. Use this to answer questions like "how much money do I have?", "what is my balance?", "how much did I spend overall?", "show me my finances". Optionally filter by date range — defaults to all time.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date yyyy-MM-dd (optional, default: all time).',
        },
        endDate: { type: 'string', description: 'End date yyyy-MM-dd (optional, default: today).' },
      },
    },
  },
  {
    name: 'get_transaction_by_id',
    description: 'Get a single transaction by its ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_categories',
    description:
      'List all spending categories the user has. Use to understand what categories exist before filtering transactions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_subscriptions',
    description: 'List all tracked subscriptions (recurring payments like Netflix, Spotify, etc.).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_spending_summary',
    description:
      'Aggregated income/expense summary. Use this for questions like "how much did I spend per category?", "show me spending by month", "compare income vs expenses". Defaults to current calendar month if no dates given. groupBy: month | category | none.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date yyyy-MM-dd. Default: first day of current month.',
        },
        endDate: { type: 'string', description: 'End date yyyy-MM-dd. Default: today.' },
        groupBy: {
          type: 'string',
          enum: ['month', 'category', 'none'],
          description: 'How to group results (default: category).',
        },
      },
    },
  },
  {
    name: 'get_subscription_costs',
    description:
      'Calculate total projected subscription costs (monthly and annually). Use to answer "how much do I pay for subscriptions?".',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
type ToolArgs = Record<string, unknown>;

async function callTool(toolName: string, args: ToolArgs): Promise<unknown> {
  // Helper: yyyy-MM-dd for a Date object
  const toDate = (d: Date) => d.toISOString().substring(0, 10);
  const today = toDate(new Date());
  const ninetyDaysAgo = toDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const firstOfMonth = toDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  switch (toolName) {
    case 'list_transactions': {
      const startDate = (args.startDate as string | undefined) ?? ninetyDaysAgo;
      const endDate = (args.endDate as string | undefined) ?? today;
      const category = args.category as string | undefined;
      const type = args.type as 'income' | 'expense' | undefined;
      const limit = Math.min(Number(args.limit ?? 50), 500);
      const offset = Number(args.offset ?? 0);

      const where: Record<string, unknown> = {
        userId: LOCAL_USER_ID,
        date: { gte: startDate, lte: endDate },
      };
      if (type === 'income') where.amount = { gt: 0 };
      if (type === 'expense') where.amount = { lt: 0 };

      const [totalCount, transactions] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          orderBy: { date: 'desc' },
          take: limit,
          skip: offset,
          include: { categories: { include: { category: { select: { name: true } } } } },
        }),
      ]);

      const filtered = category
        ? transactions.filter(t =>
            t.categories.some(c =>
              c.category.name.toLowerCase().includes((category as string).toLowerCase())
            )
          )
        : transactions;

      return {
        period: { startDate, endDate },
        totalCount,
        returnedCount: filtered.length,
        transactions: filtered.map(t => ({
          id: t.id,
          name: t.name,
          amount: t.amount,
          date: t.date,
          notes: t.notes,
          counterparty: t.counterparty,
          account: t.account,
          categories: t.categories.map(c => c.category.name),
        })),
      };
    }

    case 'get_balance': {
      const startDate = args.startDate as string | undefined;
      const endDate = (args.endDate as string | undefined) ?? today;

      const where: Record<string, unknown> = { userId: LOCAL_USER_ID };
      if (startDate || endDate) {
        where.date = {
          ...(startDate ? { gte: startDate } : {}),
          lte: endDate,
        };
      }

      const transactions = await prisma.transaction.findMany({
        where,
        include: { categories: { include: { category: { select: { name: true } } } } },
      });

      const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = transactions
        .filter(t => t.amount < 0)
        .reduce((s, t) => s + t.amount, 0);

      const byCat: Record<string, number> = {};
      for (const t of transactions.filter(t => t.amount < 0)) {
        const cats =
          t.categories.length > 0 ? t.categories.map(c => c.category.name) : ['Uncategorized'];
        for (const cat of cats) {
          byCat[cat] = (byCat[cat] ?? 0) + Math.abs(t.amount);
        }
      }
      const topCategories = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));

      return {
        period: startDate ? { startDate, endDate } : 'all time',
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(Math.abs(totalExpenses) * 100) / 100,
        net: Math.round((totalIncome + totalExpenses) * 100) / 100,
        transactionCount: transactions.length,
        topExpenseCategories: topCategories,
      };
    }

    case 'get_transaction_by_id': {
      const id = args.id as string;
      const t = await prisma.transaction.findFirst({
        where: { id, userId: LOCAL_USER_ID },
        include: { categories: { include: { category: true } } },
      });
      if (!t) return { error: 'Not found' };
      return {
        id: t.id,
        name: t.name,
        amount: t.amount,
        date: t.date,
        notes: t.notes,
        counterparty: t.counterparty,
        account: t.account,
        categories: t.categories.map(c => c.category.name),
      };
    }

    case 'list_categories': {
      const userCats = await prisma.userCategory.findMany({
        where: { userId: LOCAL_USER_ID },
        include: { category: { include: { children: true } } },
      });
      const commonCats = await prisma.category.findMany({
        where: { common: true, parentId: null },
        include: { children: true },
      });
      const all = [
        ...commonCats.map(c => ({ ...c, _source: 'common' as const })),
        ...userCats.map(uc => ({ ...uc.category, _source: 'user' as const })),
      ];
      const unique = Array.from(new Map(all.map(c => [c.id, c])).values());
      return unique.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        common: c.common,
        children: c.children.map((ch: { id: string; name: string }) => ({
          id: ch.id,
          name: ch.name,
        })),
      }));
    }

    case 'list_subscriptions': {
      const subs = await prisma.subscription.findMany({
        where: { userId: LOCAL_USER_ID },
        orderBy: { createdAt: 'desc' },
      });
      return subs.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        billingPeriod: s.billingPeriod,
        status: s.status,
        startDate: s.startDate,
        autoRenew: s.autoRenew,
        notify: s.notify,
        notes: s.notes,
      }));
    }

    case 'get_spending_summary': {
      const startDate = (args.startDate as string | undefined) ?? firstOfMonth;
      const endDate = (args.endDate as string | undefined) ?? today;
      const groupBy = (args.groupBy as string | undefined) ?? 'category';

      const transactions = await prisma.transaction.findMany({
        where: { userId: LOCAL_USER_ID, date: { gte: startDate, lte: endDate } },
        include: { categories: { include: { category: { select: { name: true } } } } },
      });

      const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = transactions
        .filter(t => t.amount < 0)
        .reduce((s, t) => s + t.amount, 0);

      const base = {
        period: { startDate, endDate },
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(Math.abs(totalExpenses) * 100) / 100,
        net: Math.round((totalIncome + totalExpenses) * 100) / 100,
        transactionCount: transactions.length,
      };

      if (groupBy === 'month') {
        const byMonth: Record<string, { income: number; expenses: number; count: number }> = {};
        for (const t of transactions) {
          const month = t.date.substring(0, 7);
          if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0, count: 0 };
          if (t.amount > 0) byMonth[month].income += t.amount;
          else byMonth[month].expenses += Math.abs(t.amount);
          byMonth[month].count++;
        }
        return { ...base, byMonth };
      }

      if (groupBy === 'category') {
        const byCat: Record<string, { income: number; expenses: number; count: number }> = {};
        for (const t of transactions) {
          const cats =
            t.categories.length > 0 ? t.categories.map(c => c.category.name) : ['Uncategorized'];
          for (const cat of cats) {
            if (!byCat[cat]) byCat[cat] = { income: 0, expenses: 0, count: 0 };
            if (t.amount > 0) byCat[cat].income += t.amount;
            else byCat[cat].expenses += Math.abs(t.amount);
            byCat[cat].count++;
          }
        }
        return { ...base, byCategory: byCat };
      }

      return base;
    }

    case 'get_subscription_costs': {
      const subs = await prisma.subscription.findMany({ where: { userId: LOCAL_USER_ID } });
      const periodToMonths: Record<string, number> = {
        MONTHLY: 1,
        'BI-MONTHLY': 2,
        QUARTERLY: 3,
        'SEMI-ANNUALLY': 6,
        ANNUALLY: 12,
        BIENNIALLY: 24,
      };
      let totalMonthly = 0;
      let activeMonthly = 0;
      const breakdown = subs.map(s => {
        const months = periodToMonths[s.billingPeriod] ?? 1;
        const monthly = s.price / months;
        totalMonthly += monthly;
        if (s.status === 'ACTIVE') activeMonthly += monthly;
        return {
          name: s.name,
          price: s.price,
          billingPeriod: s.billingPeriod,
          status: s.status,
          monthlyCost: Math.round(monthly * 100) / 100,
        };
      });
      return {
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        totalAnnually: Math.round(totalMonthly * 12 * 100) / 100,
        activeMonthly: Math.round(activeMonthly * 100) / 100,
        activeAnnually: Math.round(activeMonthly * 12 * 100) / 100,
        breakdown,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC dispatcher
// ---------------------------------------------------------------------------
async function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { id, method, params } = req;

  // Notifications (no id) must not produce a response
  if (id === undefined || id === null) {
    // handle known notification side-effects silently
    return null;
  }

  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'expense-tracker-mcp', version: '1.0.0' },
          instructions:
            'Expense Tracker MCP — read-only access to bank transactions, categories, subscriptions, and spending summaries. Use get_balance for overall financial overviews and list_transactions for filtering/searching. All amounts are in EUR; negative = expense, positive = income.',
        });
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOLS });
      case 'tools/call': {
        const name = (params as { name: string }).name;
        const toolArgs = (params as { arguments?: ToolArgs }).arguments ?? {};
        const result = await callTool(name, toolArgs);
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      }
      default:
        return rpcErr(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return rpcErr(id, -32603, e instanceof Error ? e.message : 'Internal error');
  }
}

// ---------------------------------------------------------------------------
// Next.js Route Handlers
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    );
  }

  if (Array.isArray(body)) {
    const all = await Promise.all(body.map(r => handleJsonRpc(r as JsonRpcRequest)));
    // Filter out null (notifications don't produce a response)
    const responses = all.filter((r): r is JsonRpcResponse => r !== null);
    if (responses.length === 0) {
      // All items were notifications – spec says return 202 Accepted
      return new NextResponse(null, { status: 202 });
    }
    return NextResponse.json(responses);
  }

  const response = await handleJsonRpc(body as JsonRpcRequest);
  if (response === null) {
    // Single notification – no response body
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(response);
}

export async function GET(): Promise<NextResponse> {
  // MCP Streamable HTTP spec: GET is for opening an SSE stream for
  // server-initiated messages.  This server is stateless (no session
  // management), so we don't support SSE streaming.  Return 405 per spec.
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
