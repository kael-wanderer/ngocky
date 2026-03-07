import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { Role } from '@prisma/client';

export interface AuthPayload {
    userId: string;
    email: string;
    role: Role;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Missing or invalid token'));
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
        req.user = payload;
        next();
    } catch {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}

export function authorize(...roles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new UnauthorizedError());
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return next(new ForbiddenError('Insufficient permissions'));
        }
        next();
    };
}
