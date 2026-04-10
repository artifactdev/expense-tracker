'use client';

import * as React from 'react';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAddTransactionTable } from '@/hooks/use-add-transaction-table';
import { cn } from '@/lib/utils';
import type { EnhancedCategory } from '@/types';
import { getEllipsed } from '@/utils/const';
import { ScrollArea } from '../../ui/scroll-area';

type CategoriesComboboxInputProps = {
  selectedCategories: EnhancedCategory[];
  selectedRow: number;
};

const WIDTH = 'w-[225px]';

export const CategoriesComboboxInput = ({
  selectedCategories,
  selectedRow,
}: CategoriesComboboxInputProps) => {
  const [currentInput, setCurrentInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const { userCategories, setUserCategories, updateTransactionCategories } =
    useAddTransactionTable();

  const categories = React.useMemo(
    () =>
      userCategories.map(category => ({
        value: category.id,
        label: category.name,
        isChild: !!category.parentId,
      })),
    [userCategories]
  );

  const updateUserCategories = React.useCallback(
    (newObj: EnhancedCategory) => {
      setUserCategories(prevState => [...prevState, newObj]);
    },
    [setUserCategories]
  );

  const handleSelect = React.useCallback(
    (catObj: { value: string; label: string }) => {
      const isAlreadySelected = selectedCategories.some(cat => cat.id === catObj.value);

      if (isAlreadySelected) {
        const deselected = userCategories.find(c => c.id === catObj.value);
        if (deselected?.parentId) {
          // Deselecting a child: keep the parent
          updateTransactionCategories(
            selectedRow,
            selectedCategories.filter(cat => cat.id !== catObj.value)
          );
        } else {
          // Deselecting a parent: clear everything
          updateTransactionCategories(selectedRow, []);
        }
      } else {
        const categoryToAdd = userCategories.find(cat => cat.id === catObj.value);
        const toAdd: EnhancedCategory = categoryToAdd || {
          id: catObj.value,
          name: catObj.label,
        };

        // If the selected category has a parent, auto-add the parent
        if (toAdd.parentId) {
          const parent = userCategories.find(cat => cat.id === toAdd.parentId);
          if (parent) {
            updateTransactionCategories(selectedRow, [parent, toAdd]);
          } else {
            updateTransactionCategories(selectedRow, [toAdd]);
          }
        } else {
          // Selecting a parent category: replace everything
          updateTransactionCategories(selectedRow, [toAdd]);
        }
      }
      setOpen(false);
    },
    [selectedCategories, updateTransactionCategories, selectedRow, userCategories]
  );

  const onAddNewCategory = React.useCallback(() => {
    const newValue = currentInput.trim();
    if (!newValue) return;

    const existingCategory = userCategories.find(
      cat => cat.name.toLowerCase() === newValue.toLowerCase()
    );

    if (existingCategory) {
      // Handle as if this existing category was selected
      handleSelect({
        value: existingCategory.id,
        label: existingCategory.name,
      });
    } else {
      // Create a new category with a stable temporary ID
      const newCat: EnhancedCategory = {
        id: crypto.randomUUID(),
        name: newValue,
        newEntry: true,
      };

      updateUserCategories(newCat);
      updateTransactionCategories(selectedRow, [newCat]);
    }

    setCurrentInput('');
  }, [
    currentInput,
    userCategories,
    selectedRow,
    updateUserCategories,
    updateTransactionCategories,
    setCurrentInput,
    handleSelect,
  ]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={`${WIDTH} justify-between ${getEllipsed}`}
        >
          {selectedCategories.length > 0
            ? selectedCategories.map(c => c.name).join(' › ')
            : `Select category...`}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${WIDTH} p-0`}>
        <Command>
          <CommandInput
            placeholder={`Search a category...`}
            onValueChange={value => setCurrentInput(value)}
            value={currentInput}
          />
          <ScrollArea maxHeight={225}>
            <CommandGroup>
              {categories.map(cat => (
                <CommandItem
                  key={cat.value}
                  value={cat.label}
                  onSelect={() => handleSelect(cat)}
                  className={cat.isChild ? 'pl-8' : 'font-semibold'}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCategories.find(category => category.id === cat.value)
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {cat.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup className='border-t'>
              <CommandItem onSelect={onAddNewCategory} className='text-green-500'>
                <Plus className='mr-2 h-4 w-4' />
                Add &apos;{currentInput}&apos;
              </CommandItem>
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
