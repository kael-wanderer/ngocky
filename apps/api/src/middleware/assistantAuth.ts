import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

/**
 * Service-to-service authentication for assistant routes.
 * n8n must include the X-Assistant-Api-Key header on every call.
 */
export function authenticateAssistant(req: Request, _res: Response, next: NextFunction) {
    const key = req.headers['x-assistant-api-key'];

    if (!key || key !== config.ASSISTANT_API_KEY) {
        return next(new UnauthorizedError('Invalid or missing assistant API key'));
    }

    next();
}
