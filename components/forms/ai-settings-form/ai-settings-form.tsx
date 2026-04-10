'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useFetch } from '@/hooks/use-fetch';
import {
  AISettings,
  UpdateAISettingsFormValue,
  UpdateAISettingsSchema,
} from '@/schemas/update-ai-settings-schema';
import {
  URL_AI_CATEGORIZE_EXISTING,
  URL_AI_MODELS,
  URL_AI_SETTINGS,
  URL_AI_TEST_CONNECTION,
} from '@/utils/const';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

type LogEntry = {
  name: string;
  counterparty?: string | null;
  suggestions: string[];
  status: 'ok' | 'skipped' | 'failed';
};

export const AISettingsForm = () => {
  const { toast } = useToast();
  const { fetchPetition } = useFetch();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Model list state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Bulk categorize state
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizeMode, setCategorizeMode] = useState<'uncategorized' | 'all'>('uncategorized');
  const [categorizeProgress, setCategorizeProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [categorizeLog, setCategorizeLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [categorizeResult, setCategorizeResult] = useState<{
    processed: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);

  const endpointRef = useRef<string>('');
  const hasInitialized = useRef(false);

  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: [URL_AI_SETTINGS],
    queryFn: async () => {
      const res = await fetch(URL_AI_SETTINGS);
      return res.json();
    },
    staleTime: Infinity, // don't refetch on window focus — would reset unsaved form changes
  });

  const form = useForm<UpdateAISettingsFormValue>({
    resolver: zodResolver(UpdateAISettingsSchema),
    defaultValues: {
      aiEnabled: false,
      aiCategoriesEnabled: false,
      aiSubscriptionDetection: false,
      aiEndpoint: '',
      aiModel: '',
      aiApiKey: '',
      aiSystemPrompt: '',
      aiMaxTokens: 2048,
    },
  });

  useEffect(() => {
    if (aiSettings && !hasInitialized.current) {
      hasInitialized.current = true;
      form.reset({
        aiEnabled: aiSettings.aiEnabled,
        aiCategoriesEnabled: aiSettings.aiCategoriesEnabled,
        aiSubscriptionDetection: aiSettings.aiSubscriptionDetection,
        aiEndpoint: aiSettings.aiEndpoint ?? '',
        aiModel: aiSettings.aiModel ?? '',
        aiApiKey: aiSettings.aiApiKey ?? '',
        aiSystemPrompt: aiSettings.aiSystemPrompt ?? '',
        aiMaxTokens: aiSettings.aiMaxTokens ?? 2048,
      });
      endpointRef.current = aiSettings.aiEndpoint ?? '';
    }
  }, [aiSettings, form]);

  // Reset test status when endpoint/key/model changes
  useEffect(() => {
    const sub = form.watch(() => {
      setTestStatus('idle');
      setTestError(null);
      setTestLatency(null);
    });
    return () => sub.unsubscribe();
  }, [form]);

  const onSubmit = async (data: UpdateAISettingsFormValue) => {
    setIsLoading(true);
    const { update, id: toastId } = toast({
      title: 'Saving AI settings...',
      description: 'Please wait',
    });

    const res = await fetchPetition<{ ok: boolean; error?: string }>({
      url: URL_AI_SETTINGS,
      method: 'POST',
      body: data,
    });

    if (res.ok) {
      update({
        id: toastId,
        title: 'AI settings saved',
        description: 'Your AI settings have been updated successfully.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: [URL_AI_SETTINGS] });
    } else {
      update({
        id: toastId,
        title: 'Error saving settings',
        description: res.error ?? 'Something went wrong.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Load models from endpoint
  // ---------------------------------------------------------------------------
  const handleFetchModels = async () => {
    const endpoint = form.getValues('aiEndpoint');
    const apiKey = form.getValues('aiApiKey');
    if (!endpoint) return;

    setIsFetchingModels(true);
    setAvailableModels([]);
    try {
      const res = await fetch(URL_AI_MODELS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey: apiKey || undefined }),
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.models) && json.models.length > 0) {
        setAvailableModels(json.models);
        toast({ title: `${json.models.length} models loaded`, variant: 'success' });
      } else {
        toast({
          title: 'No models found',
          description: json.error ?? 'The endpoint returned no models.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Failed to fetch models', variant: 'destructive' });
    }
    setIsFetchingModels(false);
  };

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------
  const handleTestConnection = async () => {
    const endpoint = form.getValues('aiEndpoint');
    const apiKey = form.getValues('aiApiKey');
    const model = form.getValues('aiModel');

    if (!endpoint || !model) {
      toast({ title: 'Endpoint and model are required', variant: 'destructive' });
      return;
    }

    setTestStatus('testing');
    setTestError(null);
    setTestLatency(null);

    try {
      const res = await fetch(URL_AI_TEST_CONNECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey: apiKey || undefined, model }),
      });
      const json = await res.json();
      setTestLatency(json.latencyMs ?? null);
      if (json.ok) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(json.error ?? 'Unknown error');
      }
    } catch (e) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  // ---------------------------------------------------------------------------
  // Bulk categorize existing transactions
  // ---------------------------------------------------------------------------
  const handleCategorizeExisting = async () => {
    setIsCategorizing(true);
    setCategorizeResult(null);
    setCategorizeLog([]);
    setCategorizeProgress(null);

    try {
      const response = await fetch(URL_AI_CATEGORIZE_EXISTING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: categorizeMode }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(part.slice(6));

            if (event.type === 'start') {
              setCategorizeProgress({ current: 0, total: event.total });
            } else if (event.type === 'progress') {
              setCategorizeProgress({ current: event.current, total: event.total });
              setCategorizeLog(prev => [
                ...prev,
                {
                  name: event.name,
                  counterparty: event.counterparty,
                  suggestions: event.suggestions,
                  status: event.status,
                },
              ]);
              // scroll log to bottom
              setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
            } else if (event.type === 'done') {
              setCategorizeResult({
                processed: event.processed,
                skipped: event.skipped,
                failed: event.failed,
                total: event.total,
              });
              toast({
                title: 'Kategorisierung abgeschlossen',
                description: `${event.processed} kategorisiert · ${event.skipped} übersprungen · ${event.failed} fehlgeschlagen`,
                variant: 'success',
              });
              queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
            } else if (event.type === 'error') {
              toast({ title: 'Fehler', description: event.error, variant: 'destructive' });
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (e) {
      toast({
        title: 'Kategorisierung fehlgeschlagen',
        description: e instanceof Error ? e.message : 'Verbindungsfehler',
        variant: 'destructive',
      });
    }

    setIsCategorizing(false);
  };

  const aiEnabled = form.watch('aiEnabled');
  const currentModel = form.watch('aiModel');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        {/* ── Master toggle ─────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiEnabled'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
              <div className='space-y-0.5'>
                <FormLabel className='text-base'>Enable AI</FormLabel>
                <FormDescription>
                  Activate AI features across the application. Requires a valid endpoint and API
                  key.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* ── Endpoint ──────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiEndpoint'
          render={({ field }) => (
            <FormItem>
              <FormLabel>OpenAI-compatible Endpoint</FormLabel>
              <FormControl>
                <Input
                  placeholder='https://api.openai.com/v1'
                  disabled={isLoading}
                  className={!aiEnabled ? 'pointer-events-none opacity-50' : ''}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Base URL of an OpenAI-compatible API (e.g. OpenAI, Ollama, LM Studio, Azure OpenAI).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── API Key ───────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiApiKey'
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder='sk-...'
                  disabled={isLoading}
                  className={!aiEnabled ? 'pointer-events-none opacity-50' : ''}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your API key. Stored locally in the database — not sent to any third party except
                the configured endpoint.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Model (select or manual) ───────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiModel'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>Model</FormLabel>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  disabled={!aiEnabled || !form.getValues('aiEndpoint') || isFetchingModels}
                  onClick={handleFetchModels}
                  className='h-7 gap-1.5 text-xs'
                >
                  {isFetchingModels ? (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  ) : (
                    <RefreshCw className='h-3 w-3' />
                  )}
                  Modelle laden
                </Button>
              </div>
              <FormControl>
                {availableModels.length > 0 ? (
                  <Select
                    disabled={isLoading}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Modell auswählen...' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder='gpt-4o-mini'
                    disabled={isLoading}
                    className={!aiEnabled ? 'pointer-events-none opacity-50' : ''}
                    {...field}
                  />
                )}
              </FormControl>
              <FormDescription>
                Modell-Bezeichner (z. B. gpt-4o-mini, llama3, mistral). „Modelle laden&quot; liest
                die verfügbaren Modelle direkt vom konfigurierten Endpunkt aus.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Test connection ────────────────────────────────────────────── */}
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <p className='text-sm font-medium'>Verbindung testen</p>
              <p className='text-sm text-muted-foreground'>
                Sendet eine Minimale Anfrage um Endpoint, API-Key und Modell zu prüfen.
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!aiEnabled || !currentModel || testStatus === 'testing'}
              onClick={handleTestConnection}
              className='shrink-0'
            >
              {testStatus === 'testing' && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Verbindung testen
            </Button>
          </div>

          {testStatus !== 'idle' && (
            <div className='flex items-center gap-2 text-sm'>
              {testStatus === 'testing' && <Badge variant='secondary'>Teste...</Badge>}
              {testStatus === 'ok' && (
                <>
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                  <span className='font-medium text-green-600'>Verbindung erfolgreich</span>
                  {testLatency !== null && (
                    <span className='text-muted-foreground'>({testLatency} ms)</span>
                  )}
                </>
              )}
              {testStatus === 'error' && (
                <>
                  <XCircle className='h-4 w-4 text-destructive' />
                  <span className='font-medium text-destructive'>Verbindung fehlgeschlagen</span>
                  {testError && (
                    <span className='max-w-xs truncate text-xs text-muted-foreground'>
                      {testError}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Feature Toggles ───────────────────────────────────────────── */}
        <div className='space-y-3'>
          <h3 className='text-sm font-medium uppercase tracking-wide text-muted-foreground'>
            Feature Toggles
          </h3>

          <FormField
            control={form.control}
            name='aiCategoriesEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>AI-assisted Categorization</FormLabel>
                  <FormDescription>
                    Suggest categories for new transactions based on name and amount using AI.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!aiEnabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='aiSubscriptionDetection'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>AI Subscription Detection</FormLabel>
                  <FormDescription>
                    Let AI review algorithmically detected subscription candidates and assign a
                    confidence score.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!aiEnabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* ── System Prompt ─────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiSystemPrompt'
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={
                    'Du bist ein Finanzexperte für private Finanzen und deren Kategorisierung.\nZu Lebenshaltungskosten gehören Miete, Essen, Versicherungen, Strom, Internet.\nAls Freizeitausgaben zählen Restaurants, Kino, Sport, Reisen.'
                  }
                  rows={6}
                  disabled={isLoading}
                  className={`resize-y text-sm font-mono${!aiEnabled ? 'pointer-events-none opacity-50' : ''}`}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optionaler Kontext für die KI — z.&nbsp;B. persönliche Kategorisierungsregeln oder
                deine finanzielle Situation. Wird allen KI-Anfragen vorangestellt. Maximal 2000
                Zeichen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Max Tokens ────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name='aiMaxTokens'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Tokens</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={256}
                  max={32768}
                  step={256}
                  disabled={isLoading}
                  className={!aiEnabled ? 'pointer-events-none opacity-50' : ''}
                  {...field}
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Maximale Anzahl an Tokens pro KI-Anfrage (256–32768). Bei Reasoning-Modellen
                (z.&nbsp;B. Qwen, DeepSeek) mindestens 2048 empfohlen, da der Denkprozess
                Token-Budget verbraucht.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Save button ───────────────────────────────────────────────── */}
        <Button type='submit' disabled={isLoading} className='w-full sm:w-auto'>
          {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          AI settings speichern
        </Button>

        {/* ── Bulk categorize existing transactions ─────────────────────── */}
        <div className='space-y-4 rounded-lg border p-4'>
          <div className='space-y-0.5'>
            <div className='flex items-center gap-2'>
              <Bot className='h-4 w-4' />
              <p className='text-sm font-medium'>Bestehende Transaktionen kategorisieren</p>
            </div>
            <p className='text-sm text-muted-foreground'>
              Die KI iteriert über vorhandene Transaktionen und weist ihnen automatisch Kategorien
              zu. Einstellungen müssen vorher gespeichert sein.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex items-center gap-2'>
              <label className='text-sm text-muted-foreground'>Modus:</label>
              <Select
                value={categorizeMode}
                onValueChange={v => setCategorizeMode(v as 'uncategorized' | 'all')}
                disabled={!aiEnabled || isCategorizing}
              >
                <SelectTrigger className='w-52'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='uncategorized'>Nur unkategorisierte</SelectItem>
                  <SelectItem value='all'>Alle (überschreiben)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={!aiEnabled || isCategorizing}
              onClick={handleCategorizeExisting}
            >
              {isCategorizing ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Läuft...
                </>
              ) : (
                'Jetzt kategorisieren'
              )}
            </Button>
          </div>

          {/* Progress bar */}
          {(isCategorizing || categorizeProgress) && (
            <div className='space-y-1'>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                {categorizeProgress ? (
                  <>
                    <span>
                      {categorizeProgress.current} / {categorizeProgress.total} Transaktionen
                    </span>
                    <span>
                      {categorizeProgress.total > 0
                        ? Math.round((categorizeProgress.current / categorizeProgress.total) * 100)
                        : 0}
                      %
                    </span>
                  </>
                ) : (
                  <span>Wird vorbereitet...</span>
                )}
              </div>
              <Progress
                value={
                  categorizeProgress && categorizeProgress.total > 0
                    ? (categorizeProgress.current / categorizeProgress.total) * 100
                    : undefined
                }
                className='h-1.5'
              />
            </div>
          )}

          {/* Live log — immer sichtbar, sobald je kategorisiert wurde */}
          {(isCategorizing || categorizeLog.length > 0 || categorizeResult) && (
            <div className='overflow-hidden rounded-md border bg-muted/30'>
              <div className='max-h-56 divide-y divide-border overflow-y-auto font-mono text-xs'>
                {categorizeLog.length === 0 ? (
                  <div className='flex items-center gap-2 px-3 py-2 text-muted-foreground'>
                    {isCategorizing ? (
                      <>
                        <Loader2 className='h-3 w-3 animate-spin' />
                        Starte...
                      </>
                    ) : (
                      <span>Keine Einträge.</span>
                    )}
                  </div>
                ) : (
                  categorizeLog.map((entry, idx) => (
                    <div key={idx} className='flex items-start gap-2 px-3 py-1.5'>
                      <span className='mt-0.5 shrink-0'>
                        {entry.status === 'ok' && (
                          <CheckCircle2 className='h-3.5 w-3.5 text-green-500' />
                        )}
                        {entry.status === 'skipped' && (
                          <span className='text-muted-foreground'>–</span>
                        )}
                        {entry.status === 'failed' && (
                          <XCircle className='h-3.5 w-3.5 text-destructive' />
                        )}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-foreground'>
                          {entry.counterparty ? (
                            <>
                              <span className='font-semibold'>{entry.counterparty}</span> ·{' '}
                              {entry.name}
                            </>
                          ) : (
                            entry.name
                          )}
                        </p>
                        {entry.suggestions.length > 0 && (
                          <p className='text-muted-foreground'>{entry.suggestions.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Summary badges */}
          {categorizeResult && (
            <div className='flex flex-wrap gap-2 text-sm'>
              <Badge variant='secondary'>{categorizeResult.total} gesamt</Badge>
              <Badge className='border-green-300 bg-green-500/15 text-green-700'>
                {categorizeResult.processed} kategorisiert
              </Badge>
              {categorizeResult.skipped > 0 && (
                <Badge variant='outline'>{categorizeResult.skipped} übersprungen</Badge>
              )}
              {categorizeResult.failed > 0 && (
                <Badge variant='destructive'>{categorizeResult.failed} fehlgeschlagen</Badge>
              )}
            </div>
          )}
        </div>
      </form>
    </Form>
  );
};
