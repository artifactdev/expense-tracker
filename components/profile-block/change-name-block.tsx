'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFetch } from '@/hooks/use-fetch';
import { ChangeNameSchema, type ChangeNameFormValue } from '@/schemas/change-name-schema';
import { URL_CHANGE_NAME } from '@/utils/const';
import { useToast } from '../ui/use-toast';

interface ChangeNameBlockProps {
  userId: string;
}

interface ChangeNameResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export const ChangeNameBlock = ({ userId }: ChangeNameBlockProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { fetchPetition } = useFetch();

  const form = useForm<ChangeNameFormValue>({
    resolver: zodResolver(ChangeNameSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: ChangeNameFormValue) => {
    const { update, id: toastId } = toast({
      title: 'Changing name...',
      description: 'Please wait while the name is being changed',
      variant: 'default',
    });
    setLoading(true);
    const response = await fetchPetition<ChangeNameResponse>({
      url: URL_CHANGE_NAME,
      method: 'POST',
      body: { userId, name: data.name },
    });
    if (response.error) {
      update({
        id: toastId,
        title: 'Error changing the name',
        description: response.error,
        variant: 'destructive',
      });
    } else if (response.message) {
      update({
        id: toastId,
        title: 'Name changed successfully',
        description: response.message,
        variant: 'success',
      });
      form.reset();
    }
    setLoading(false);
  };

  return (
    <div>
      <p className='pb-4 text-muted-foreground'>Update your display name below.</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Name</FormLabel>
                <FormControl>
                  <Input placeholder='Enter new name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={loading}>
            {loading ? 'Saving...' : 'Save Name'}
          </Button>
        </form>
      </Form>
    </div>
  );
};
