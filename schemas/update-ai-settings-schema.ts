import { z } from 'zod';

export const UpdateAISettingsSchema = z.object({
  aiEnabled: z.boolean().optional(),
  aiCategoriesEnabled: z.boolean().optional(),
  aiSubscriptionDetection: z.boolean().optional(),
  aiEndpoint: z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional(),
  aiModel: z.string().optional(),
  aiApiKey: z.string().optional(),
  aiSystemPrompt: z.string().max(2000, 'Max 2000 characters').optional(),
  aiMaxTokens: z.coerce.number().int().min(256).max(32768).optional(),
});

export type UpdateAISettingsFormValue = z.infer<typeof UpdateAISettingsSchema>;

export type AISettings = {
  aiEnabled: boolean;
  aiCategoriesEnabled: boolean;
  aiSubscriptionDetection: boolean;
  aiEndpoint: string | null;
  aiModel: string | null;
  aiApiKey: string | null;
  aiSystemPrompt: string | null;
  aiMaxTokens: number | null;
};
