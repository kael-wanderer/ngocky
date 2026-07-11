import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AgentSettingsService } from '../services/agentSettings';
import { createProviderAdapter } from '../services/assistant/providers/factory';
import { sanitizedProviderError } from '../services/assistant/providers/types';
import { AppError, ValidationError } from '../utils/errors';
import { agentConnectionSchema, providerParamSchema, updateAgentSettingsSchema } from '../validators/agentSettings';

const router = Router();
const upstreamLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.use(authenticate, authorize('OWNER'));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await AgentSettingsService.get()); } catch (error) { next(error); }
});

router.put('/', validate(updateAgentSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await AgentSettingsService.update(req.body)); } catch (error) { next(error); }
});

router.delete('/:provider/key', validate(providerParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await AgentSettingsService.clearKey(req.params.provider as any)); } catch (error) { next(error); }
});

async function adapterFromRequest(body: any) {
    const config = await AgentSettingsService.getProviderConfig(body.activeProvider, {
        activeProvider: body.activeProvider,
        model: body.model,
        effort: body.effort,
        baseUrl: body.baseUrl,
        ...(body.apiKey ? { apiKey: body.apiKey } : body.useSavedKey ? {} : { apiKey: null }),
    });
    if (!config) throw new ValidationError('Provider credentials are not configured');
    return createProviderAdapter(config);
}

router.post('/models', upstreamLimiter, validate(agentConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ models: await (await adapterFromRequest(req.body)).listModels() });
    } catch (error) {
        if (error instanceof AppError) return next(error);
        const safe = sanitizedProviderError(error);
        next(new AppError(502, safe.message, safe.category.toUpperCase()));
    }
});

router.post('/test', upstreamLimiter, validate(agentConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await (await adapterFromRequest(req.body)).testConnection()); } catch (error) { next(error); }
});

export default router;
