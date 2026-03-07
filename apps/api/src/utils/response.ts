import { Response } from 'express';

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
    const response: ApiResponse<T> = { success: true, data };
    return res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T) {
    return sendSuccess(res, data, 201);
}

export function sendPaginated<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
) {
    const response: ApiResponse<T[]> = {
        success: true,
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
    return res.status(200).json(response);
}

export function sendMessage(res: Response, message: string, statusCode = 200) {
    const response: ApiResponse = { success: true, message };
    return res.status(statusCode).json(response);
}
