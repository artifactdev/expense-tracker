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
      'List transactions. Filters: startDate, endDate (yyyy-MM-dd), category (partial), type (income|expense), limit (default 50, max 500), offset.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        category: { type: 'string' },
        type: { type: 'string', enum: ['income', 'expense'] },
        limit: { type: 'number', minimum: 1, maximum: 500 },
        offset: { type: 'number', minimum: 0 },
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
    description: 'List all categories available to the user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_subscriptions',
    description: 'List all subscriptions for the user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_spending_summary',
    description:
      'Aggregated income/expense summary for a date range. groupBy: month | category | none.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        groupBy: { type: 'string', enum: ['month', 'category', 'none'] },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_subscription_costs',
    description: 'Calculate total projected subscription costs (monthly and annually).',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
type ToolArgs = Record<string, unknown>;

async function callTool(toolName: string, args: ToolArgs): Promise<unknown> {
  switch (toolName) {
    case 'list_transactions': {
      const startDate = args.startDate as string | undefined;
      const endDate = args.endDate as string | undefined;
      const category = args.category as string | undefined;
      const type = args.type as 'income' | 'expense' | undefined;
      const limit = Math.min(Number(args.limit ?? 50), 500);
      const offset = Number(args.offset ?? 0);

      const where: Record<string, unknown> = { userId: LOCAL_USER_ID };
      if (startDate || endDate) {
        where.date = {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        };
      }
      if (type === 'income') where.amount = { gt: 0 };
      if (type === 'expense') where.amount = { lt: 0 };

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        include: { categories: { include: { category: { select: { name: true } } } } },
      });

      const filtered = category
        ? transactions.filter(t =>
            t.categories.some(c =>
              c.category.name.toLowerCase().includes((category as string).toLowerCase())
            )
          )
        : transactions;

      return filtered.map(t => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        date: t.date,
        notes: t.notes,
        counterparty: t.counterparty,
        account: t.account,
        categories: t.categories.map(c => c.category.name),
      }));
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
      const startDate = args.startDate as string;
      const endDate = args.endDate as string;
      const groupBy = (args.groupBy as string | undefined) ?? 'none';

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
async function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = req;
  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'expense-tracker-mcp', version: '1.0.0' },
        });
      case 'notifications/initialized':
        return ok(id, {});
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
    const responses = await Promise.all(body.map(r => handleJsonRpc(r as JsonRpcRequest)));
    return NextResponse.json(responses);
  }
  return NextResponse.json(await handleJsonRpc(body as JsonRpcRequest));
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'expense-tracker-mcp',
    version: '1.0.0',
    protocol: 'MCP 2025-03-26',
    transport: 'HTTP POST to /api/mcp',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    configExample: {
      mcpServers: {
        'expense-tracker': {
          url: 'http://localhost:3000/api/mcp',
          transport: { type: 'http' },
        },
      },
    },
  });
}
