import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { errorMessages, LOCAL_USER_ID } from '@/utils/const';

// GET /api/categories – alle Kategorien des Users mit Unterkategorien
export const GET = async () => {
  try {
    const userCats = await prisma.userCategory.findMany({
      where: { userId: LOCAL_USER_ID },
      include: {
        category: {
          include: { children: true },
        },
      },
    });

    const categories = userCats.map(({ category }) => ({
      id: category.id,
      name: category.name,
      common: category.common,
      parentId: category.parentId,
      children: category.children.map(c => ({
        id: c.id,
        name: c.name,
        common: c.common,
        parentId: c.parentId,
      })),
    }));

    return NextResponse.json({ ok: true, categories }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : errorMessages.retrieveCategories;
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};

// POST /api/categories – neue Kategorie erstellen
export const POST = async (req: NextRequest) => {
  try {
    const { name, parentId } = (await req.json()) as { name: string; parentId?: string };
    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      // Bei Duplikat einfach zum User verlinken falls noch nicht vorhanden
      await prisma.userCategory.upsert({
        where: { userId_categoryId: { userId: LOCAL_USER_ID, categoryId: existing.id } },
        update: {},
        create: { userId: LOCAL_USER_ID, categoryId: existing.id },
      });
      return NextResponse.json(
        {
          ok: true,
          category: { id: existing.id, name: existing.name, parentId: existing.parentId },
        },
        { status: 200 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        parentId: parentId ?? null,
      },
    });

    await prisma.userCategory.create({
      data: { userId: LOCAL_USER_ID, categoryId: category.id },
    });

    return NextResponse.json(
      { ok: true, category: { id: category.id, name: category.name, parentId: category.parentId } },
      { status: 201 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error creating category';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};

// PATCH /api/categories – Kategorie umbenennen oder parentId ändern
export const PATCH = async (req: NextRequest) => {
  try {
    const { id, name, parentId } = (await req.json()) as {
      id: string;
      name?: string;
      parentId?: string | null;
    };
    if (!id) return NextResponse.json({ ok: false, error: 'ID is required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      updateData.name = name.trim();
      updateData.slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
    if (parentId !== undefined) updateData.parentId = parentId;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, category }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error updating category';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};

// DELETE /api/categories?id=xxx – Kategorie vom User entfernen
export const DELETE = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'ID is required' }, { status: 400 });

    // Erst den UserCategory-Eintrag entfernen
    await prisma.userCategory.deleteMany({
      where: { userId: LOCAL_USER_ID, categoryId: id },
    });

    // Kategorie nur löschen wenn kein anderer User sie nutzt und keine Transaktionen
    const stillUsed = await prisma.userCategory.count({ where: { categoryId: id } });
    const usedInTransactions = await prisma.transactionCategory.count({
      where: { categoryId: id },
    });

    if (stillUsed === 0 && usedInTransactions === 0) {
      // Auch Kinder unlinkten und löschen
      await prisma.userCategory.deleteMany({ where: { category: { parentId: id } } });
      await prisma.category.deleteMany({ where: { parentId: id } });
      await prisma.category.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error deleting category';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
