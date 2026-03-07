import { Request } from 'express';

/** Safely extract a single query parameter value */
export function queryStr(req: Request, key: string): string | undefined {
    const val = req.query[key];
    if (Array.isArray(val)) return val[0] as string;
    return val as string | undefined;
}

/** Extract a query param as number with a default */
export function queryInt(req: Request, key: string, defaultVal: number): number {
    const val = queryStr(req, key);
    if (!val) return defaultVal;
    const n = parseInt(val, 10);
    return isNaN(n) ? defaultVal : n;
}

/** Extract route param (always a string in Express) */
export function paramStr(req: Request, key: string): string {
    return req.params[key] as string;
}
