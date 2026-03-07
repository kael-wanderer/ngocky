import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    // Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
    }

    // Custom app errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
        });
    }

    // Prisma known errors
    if (err.constructor.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as any;
        if (prismaErr.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'A record with this value already exists',
                code: 'DUPLICATE',
            });
        }
        if (prismaErr.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
                code: 'NOT_FOUND',
            });
        }
    }

    // Unknown errors
    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        code: 'INTERNAL_ERROR',
    });
}
