import { z } from 'zod';

export const agentProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'OPENAI_COMPATIBLE']);
export const agentEffortSchema = z.enum(['auto', 'low', 'medium', 'high']);

const agentSettingsObject = z.object({
    activeProvider: agentProviderSchema,
    model: z.string().trim().min(1).max(200),
    effort: agentEffortSchema.default('auto'),
    baseUrl: z.string().trim().url().max(2048).nullable().optional(),
    apiKey: z.string().trim().min(8).max(500).optional(),
});

function requireCompatibleBaseUrl(value: z.infer<typeof agentSettingsObject>, ctx: z.RefinementCtx) {
    if (value.activeProvider === 'OPENAI_COMPATIBLE' && !value.baseUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'Base URL is required' });
    }
}

export const updateAgentSettingsSchema = agentSettingsObject.superRefine(requireCompatibleBaseUrl);

export const providerParamSchema = z.object({ provider: agentProviderSchema });
export const agentConnectionSchema = agentSettingsObject.extend({ useSavedKey: z.boolean().default(true) }).superRefine(requireCompatibleBaseUrl);
