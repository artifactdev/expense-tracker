'use client';

import { useEffect, useState } from 'react';

import { type RefetchOptions } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useFetch } from '@/hooks/use-fetch';
import type { UserSubscriptionResponse } from '@/types';
import { BillingPeriod, SubscriptionStatus } from '@/types/subscriptions';
import { URL_ADD_SUBSCRIPTION, URL_DETECT_SUBSCRIPTIONS } from '@/utils/const';
import type { DetectedSubscriptionCandidate } from '@/utils/detect-subscriptions';

type EnrichedCandidate = DetectedSubscriptionCandidate & {
  aiConfidence: number | null;
  aiNotes: string | null;
};

interface DetectSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;

  refetch: (options?: RefetchOptions | undefined) => any;
}

const confidenceLabel = (score: number | null) => {
  if (score === null) return null;
  if (score >= 0.8) return { label: 'High', className: 'border-green-500 text-green-600' };
  if (score >= 0.5) return { label: 'Medium', className: 'border-yellow-500 text-yellow-600' };
  return { label: 'Low', className: 'border-red-400 text-red-500' };
};

export const DetectSubscriptionsModal: React.FC<DetectSubscriptionsModalProps> = ({
  isOpen,
  onClose,
  refetch,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [candidates, setCandidates] = useState<EnrichedCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { fetchPetition } = useFetch();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      handleDetect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDetect = async () => {
    setIsDetecting(true);
    setCandidates([]);
    setSelected(new Set());
    try {
      const res = await fetch(URL_DETECT_SUBSCRIPTIONS);
      const data: { ok: boolean; candidates?: EnrichedCandidate[] } = await res.json();
      if (data.ok && data.candidates) {
        setCandidates(data.candidates);
        // Pre-select high-confidence candidates
        const preSelected = new Set(
          data.candidates
            .filter(c => c.aiConfidence === null || c.aiConfidence >= 0.7)
            .map(c => c.normalizedName)
        );
        setSelected(preSelected);
      }
    } catch {
      toast({
        title: 'Detection failed',
        description: 'Could not analyze transactions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleSelect = (normalizedName: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(normalizedName)) next.delete(normalizedName);
      else next.add(normalizedName);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const toAdd = candidates.filter(c => selected.has(c.normalizedName));
    if (toAdd.length === 0) return;
    setIsAdding(true);

    let added = 0;
    for (const c of toAdd) {
      const res = await fetchPetition<UserSubscriptionResponse>({
        url: URL_ADD_SUBSCRIPTION,
        method: 'POST',
        body: {
          subscriptionData: {
            name: c.name,
            price: c.amount,
            startDate: c.lastDate,
            billingPeriod: c.billingPeriod as BillingPeriod,
            autoRenew: true,
            notify: false,
            status: SubscriptionStatus.Active,
            notes: c.aiNotes ?? undefined,
          },
        },
      });
      if (res.updatedUser) added++;
    }

    toast({
      title: 'Subscriptions added',
      description: `${added} subscription${added !== 1 ? 's' : ''} added successfully.`,
      variant: added > 0 ? 'success' : 'destructive',
    });
    refetch();
    onClose();
    setIsAdding(false);
  };

  if (!isMounted) return null;

  return (
    <Modal
      title='Detect Subscriptions'
      description='Recurring transactions detected in your transaction history'
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className='space-y-4'>
        {isDetecting ? (
          <div className='flex flex-col items-center gap-2 py-8'>
            <Search className='size-8 animate-pulse text-muted-foreground' />
            <p className='text-sm text-muted-foreground'>Analyzing your transactions…</p>
          </div>
        ) : candidates.length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            No recurring transactions detected. Import more transaction history to improve
            detection.
          </p>
        ) : (
          <ScrollArea className='max-h-[420px]'>
            <div className='space-y-2 pr-2'>
              {candidates.map(c => {
                const conf = confidenceLabel(c.aiConfidence);
                const isChecked = selected.has(c.normalizedName);
                return (
                  <label
                    key={c.normalizedName}
                    className='flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50'
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleSelect(c.normalizedName)}
                      className='mt-0.5'
                    />
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>{c.name}</span>
                        {conf && (
                          <Badge variant='outline' className={`text-xs ${conf.className}`}>
                            {conf.label} confidence
                          </Badge>
                        )}
                      </div>
                      <div className='flex flex-wrap gap-x-4 text-xs text-muted-foreground'>
                        <span>
                          {c.amount.toFixed(2)} · {c.billingPeriod.toLowerCase()}
                        </span>
                        <span>{c.occurrences} occurrences</span>
                        {c.aiNotes && <span className='italic'>{c.aiNotes}</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {!isDetecting && candidates.length > 0 && (
          <div className='flex items-center justify-between gap-2 pt-2'>
            <Button variant='outline' onClick={handleDetect} disabled={isDetecting || isAdding}>
              Re-scan
            </Button>
            <Button onClick={handleAddSelected} disabled={selected.size === 0 || isAdding}>
              {isAdding ? 'Adding…' : `Add selected (${selected.size})`}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
