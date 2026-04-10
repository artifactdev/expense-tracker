'use client';

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FolderOpen, Pencil, Plus, Tag, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import type { Categories } from '@/types';

const API = '/api/categories';
const NO_PARENT = '__none__';

interface CategoryWithChildren extends Categories {
  children?: CategoryWithChildren[];
}

interface CategoriesResponse {
  ok: boolean;
  categories?: CategoryWithChildren[];
  error?: string;
}

type DialogMode = 'create-root' | 'create-child' | 'rename';

interface DialogState {
  mode: DialogMode;
  parentId?: string;
  category?: CategoryWithChildren;
}

export const CategoriesContent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithChildren | null>(null);
  const [inputName, setInputName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string>(NO_PARENT);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<CategoriesResponse>({
    queryKey: [API],
    queryFn: () => fetch(API).then(r => r.json()),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [API] });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; parentId?: string }) =>
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: res => {
      if (res.ok) {
        toast({ title: 'Category created', variant: 'success' });
        invalidate();
        setDialog(null);
      } else {
        toast({ title: res.error ?? 'Error', variant: 'destructive' });
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: (body: { id: string; name: string; parentId?: string | null }) =>
      fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: res => {
      if (res.ok) {
        toast({ title: 'Category updated', variant: 'success' });
        invalidate();
        setDialog(null);
      } else {
        toast({ title: res.error ?? 'Error', variant: 'destructive' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`${API}?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: res => {
      if (res.ok) {
        toast({ title: 'Category removed', variant: 'success' });
        invalidate();
        setDeleteTarget(null);
      } else {
        toast({ title: res.error ?? 'Error', variant: 'destructive' });
      }
    },
  });

  const openCreate = (parentId?: string) => {
    setInputName('');
    setSelectedParentId(parentId ?? NO_PARENT);
    setDialog({ mode: parentId ? 'create-child' : 'create-root', parentId });
  };

  const openRename = (cat: CategoryWithChildren) => {
    setInputName(cat.name);
    setSelectedParentId(cat.parentId ?? NO_PARENT);
    setDialog({ mode: 'rename', category: cat });
  };

  const handleDialogSubmit = () => {
    if (!inputName.trim()) return;
    if (dialog?.mode === 'rename' && dialog.category) {
      renameMutation.mutate({
        id: dialog.category.id,
        name: inputName.trim(),
        parentId: selectedParentId === NO_PARENT ? null : selectedParentId,
      });
    } else {
      createMutation.mutate({
        name: inputName.trim(),
        parentId: selectedParentId === NO_PARENT ? undefined : selectedParentId,
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Nur Root-Kategorien (parentId === null) anzeigen, Kinder werden darunter eingerückt
  const rootCategories = (data?.categories ?? []).filter(c => !c.parentId);
  // Alle Kategorien flach für den Parent-Select im Edit-Dialog
  const allCategories = data?.categories ?? [];

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className='text-destructive'>Error loading categories</p>;

  return (
    <>
      <div className='flex items-start justify-between'>
        <Heading
          title='Categories'
          description='Manage your expense categories and subcategories'
        />
        <Button onClick={() => openCreate()} size='sm'>
          <Plus className='mr-2 h-4 w-4' /> New Category
        </Button>
      </div>
      <Separator />

      {rootCategories.length === 0 && (
        <p className='py-8 text-center text-sm text-muted-foreground'>
          No categories yet. Create your first one!
        </p>
      )}

      <div className='mt-2 space-y-1'>
        {rootCategories.map(cat => {
          const isExpanded = expandedIds.has(cat.id);
          const hasChildren = (cat.children?.length ?? 0) > 0;
          return (
            <div key={cat.id} className='rounded-lg border bg-card'>
              {/* Root category row */}
              <div className='flex items-center gap-2 px-3 py-2'>
                <button
                  onClick={() => hasChildren && toggleExpand(cat.id)}
                  className={`flex flex-1 items-center gap-1 text-left ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {hasChildren ? (
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  ) : (
                    <FolderOpen className='h-4 w-4 shrink-0 text-muted-foreground' />
                  )}
                  <span className='text-sm font-medium'>{cat.name}</span>
                  {hasChildren && (
                    <span className='ml-1 text-xs text-muted-foreground'>
                      ({cat.children!.length})
                    </span>
                  )}
                </button>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7'
                    title='Add subcategory'
                    onClick={() => openCreate(cat.id)}
                  >
                    <Plus className='h-3.5 w-3.5' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7'
                    title='Rename'
                    onClick={() => openRename(cat)}
                  >
                    <Pencil className='h-3.5 w-3.5' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7 text-destructive hover:text-destructive'
                    title='Delete'
                    onClick={() => setDeleteTarget(cat)}
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </Button>
                </div>
              </div>

              {/* Subcategories */}
              {isExpanded && hasChildren && (
                <div className='border-t'>
                  {cat.children!.map(child => (
                    <div
                      key={child.id}
                      className='flex items-center gap-2 px-3 py-2 pl-8 odd:bg-muted/30'
                    >
                      <Tag className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                      <span className='flex-1 text-sm'>{child.name}</span>
                      <div className='flex shrink-0 items-center gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          title='Rename'
                          onClick={() => openRename(child)}
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7 text-destructive hover:text-destructive'
                          title='Delete'
                          onClick={() => setDeleteTarget(child)}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Rename Dialog */}
      <Dialog open={!!dialog} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'rename'
                ? 'Edit Category'
                : dialog?.mode === 'create-child'
                  ? 'New Subcategory'
                  : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <Input
              placeholder='Category name'
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDialogSubmit()}
              autoFocus
            />
            {/* Parent selector (only in edit mode or create-root) */}
            {(dialog?.mode === 'rename' || dialog?.mode === 'create-root') && (
              <div>
                <label className='mb-1 block text-xs text-muted-foreground'>
                  Parent category (optional)
                </label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder='None (root category)' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>None (root category)</SelectItem>
                    {allCategories
                      .filter(c => !c.parentId && c.id !== dialog?.category?.id)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDialogSubmit}
              disabled={!inputName.trim() || createMutation.isPending || renameMutation.isPending}
            >
              {dialog?.mode === 'rename' ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?.children?.length ?? 0) > 0
                ? 'This will also delete all subcategories. The category will be removed from this user but kept if used in transactions.'
                : 'The category will be removed from your list. If it is used in transactions it will be kept in the database.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive hover:bg-destructive/90'
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
