import fs from 'fs';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paramStr } from '../utils/query';
import {
    createHealthPersonSchema,
    updateHealthPersonSchema,
    createHealthLogSchema,
    updateHealthLogSchema,
} from '../validators/phase2';

const router = Router();
router.use(authenticate);

// ─── Upload directory ────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.env.UPLOAD_DIR || process.cwd(), 'uploads', 'healthbook');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed'));
        }
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertPersonOwner(personId: string, userId: string) {
    const person = await prisma.healthPerson.findFirst({ where: { id: personId, userId } });
    if (!person) throw new NotFoundError('Health person not found');
    return person;
}

async function assertLogOwner(logId: string, personId: string, userId: string) {
    const log = await prisma.healthLog.findFirst({ where: { id: logId, personId, userId } });
    if (!log) throw new NotFoundError('Health log not found');
    return log;
}

function dateAtHourUTC(dateISO: string, hour: number, tz: string): Date {
    const probe = new Date(`${dateISO}T12:00:00.000Z`);
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(probe);
    const get = (type: string) => { const v = parts.find(p => p.type === type)?.value; return v ? parseInt(v) : 0; };
    let h = get('hour'); if (h === 24) h = 0;
    const localAsUTC = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
    const offsetMs = localAsUTC - probe.getTime();
    const midnight = new Date(`${dateISO}T00:00:00.000Z`);
    const dayStartUTC = new Date(midnight.getTime() - offsetMs);
    return new Date(dayStartUTC.getTime() + hour * 3_600_000);
}

async function createCheckupCalendarEvent(
    nextCheckupDate: string, personName: string, location: string | undefined,
    description: string | undefined, userId: string, tx?: any,
): Promise<string | null> {
    const db = tx ?? prisma;
    const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = user?.timezone ?? 'Asia/Ho_Chi_Minh';
    const dateOnly = nextCheckupDate.slice(0, 10);
    const title = `Next checkup – ${personName}${location ? ` at ${location}` : ''}`;
    const event = await db.calendarEvent.create({
        data: {
            title,
            type: 'MEETING',
            description: description ?? null,
            startDate: dateAtHourUTC(dateOnly, 9, tz),
            endDate: dateAtHourUTC(dateOnly, 12, tz),
            allDay: false,
            isShared: true,
            category: 'HEALTHBOOK',
            createdById: userId,
        },
    });
    return event.id;
}

async function createHealthExpense(cost: number, date: Date, description: string, userId: string, tx?: any): Promise<string | null> {
    if (!Number.isFinite(cost) || cost <= 0) return null;
    const db = tx ?? prisma;
    const expense = await db.expense.create({
        data: {
            description: description || 'Healthcare',
            type: 'PAY',
            payment: 'BANK_TRANSFER',
            scope: 'FAMILY',
            date,
            category: 'Healthcare',
            amount: cost,
            isShared: false,
            sourceModule: 'Health',
            userId,
        },
    });
    return expense.id;
}

// ─── File serve/delete (must be before /:personId) ───────────────────────────

router.get('/files/person/:fileId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = await prisma.healthPersonFile.findUnique({ where: { id: paramStr(req, 'fileId') } });
        if (!file) throw new NotFoundError('File not found');
        if (file.userId !== req.user!.userId) throw new NotFoundError('File not found');
        if (!fs.existsSync(file.path)) throw new NotFoundError('File not found on disk');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
        fs.createReadStream(file.path).pipe(res);
    } catch (err) { next(err); }
});

router.delete('/files/person/:fileId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = await prisma.healthPersonFile.findUnique({ where: { id: paramStr(req, 'fileId') } });
        if (!file) throw new NotFoundError('File not found');
        if (file.userId !== req.user!.userId) throw new NotFoundError('File not found');
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        await prisma.healthPersonFile.delete({ where: { id: file.id } });
        sendMessage(res, 'File deleted');
    } catch (err) { next(err); }
});

router.get('/files/log/:fileId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = await prisma.healthLogFile.findUnique({ where: { id: paramStr(req, 'fileId') } });
        if (!file) throw new NotFoundError('File not found');
        if (file.userId !== req.user!.userId) throw new NotFoundError('File not found');
        if (!fs.existsSync(file.path)) throw new NotFoundError('File not found on disk');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
        fs.createReadStream(file.path).pipe(res);
    } catch (err) { next(err); }
});

router.delete('/files/log/:fileId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = await prisma.healthLogFile.findUnique({ where: { id: paramStr(req, 'fileId') } });
        if (!file) throw new NotFoundError('File not found');
        if (file.userId !== req.user!.userId) throw new NotFoundError('File not found');
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        await prisma.healthLogFile.delete({ where: { id: file.id } });
        sendMessage(res, 'File deleted');
    } catch (err) { next(err); }
});

// ─── Health Persons ──────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const where: any = { OR: [{ userId: req.user!.userId }, { isShared: true }] };
        const persons = await prisma.healthPerson.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                _count: { select: { files: true, logs: true } },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        sendSuccess(res, persons);
    } catch (err) { next(err); }
});

router.post('/', validate(createHealthPersonSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const maxOrder = await prisma.healthPerson.aggregate({
            where: { userId: req.user!.userId },
            _max: { sortOrder: true },
        });
        const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        const person = await prisma.healthPerson.create({
            data: {
                ...req.body,
                dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
                idIssueDate: req.body.idIssueDate ? new Date(req.body.idIssueDate) : null,
                passportIssueDate: req.body.passportIssueDate ? new Date(req.body.passportIssueDate) : null,
                insuranceExpiry: req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : null,
                workInsuranceValidFrom: req.body.workInsuranceValidFrom ? new Date(req.body.workInsuranceValidFrom) : null,
                sortOrder,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, person);
    } catch (err) { next(err); }
});

router.get('/:personId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const person = await prisma.healthPerson.findFirst({
            where: {
                id: personId,
                OR: [{ userId: req.user!.userId }, { isShared: true }],
            },
            include: {
                user: { select: { id: true, name: true } },
                files: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!person) throw new NotFoundError('Health person not found');
        sendSuccess(res, person);
    } catch (err) { next(err); }
});

router.patch('/:personId', validate(updateHealthPersonSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        await assertPersonOwner(personId, req.user!.userId);
        const updated = await prisma.healthPerson.update({
            where: { id: personId },
            data: {
                ...req.body,
                dateOfBirth: req.body.dateOfBirth === null ? null : req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
                idIssueDate: req.body.idIssueDate === null ? null : req.body.idIssueDate ? new Date(req.body.idIssueDate) : undefined,
                passportIssueDate: req.body.passportIssueDate === null ? null : req.body.passportIssueDate ? new Date(req.body.passportIssueDate) : undefined,
                insuranceExpiry: req.body.insuranceExpiry === null ? null : req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : undefined,
                workInsuranceValidFrom: req.body.workInsuranceValidFrom === null ? null : req.body.workInsuranceValidFrom ? new Date(req.body.workInsuranceValidFrom) : undefined,
            },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:personId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        await assertPersonOwner(personId, req.user!.userId);
        // delete files on disk
        const files = await prisma.healthPersonFile.findMany({ where: { personId } });
        for (const f of files) { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); }
        const logFiles = await prisma.healthLogFile.findMany({
            where: { log: { personId } },
        });
        for (const f of logFiles) { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); }
        await prisma.healthPerson.delete({ where: { id: personId } });
        sendMessage(res, 'Health person deleted');
    } catch (err) { next(err); }
});

// ─── Person file upload ───────────────────────────────────────────────────────

router.post('/:personId/files', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        await assertPersonOwner(personId, req.user!.userId);
        if (!req.file) throw new ValidationError('No file uploaded');
        const file = await prisma.healthPersonFile.create({
            data: {
                personId,
                originalName: req.file.originalname,
                storedName: req.file.filename,
                mimeType: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
                label: req.body.label || null,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, file);
    } catch (err) { next(err); }
});

// ─── Health Logs ─────────────────────────────────────────────────────────────

router.get('/:personId/logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const logs = await prisma.healthLog.findMany({
            where: {
                personId,
                OR: [{ userId: req.user!.userId }, { person: { isShared: true } }],
            },
            include: { files: { orderBy: { createdAt: 'asc' } } },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
        sendSuccess(res, logs);
    } catch (err) { next(err); }
});

router.post('/:personId/logs', validate(createHealthLogSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const { addExpense, addToCalendar, ...logData } = req.body;
        const person = await prisma.healthPerson.findUnique({ where: { id: personId }, select: { name: true } });
        const userId = req.user!.userId;
        const cost = req.body.cost ? Number(req.body.cost) : 0;

        const log = await prisma.$transaction(async (tx) => {
            let linkedExpenseId: string | null = null;
            let linkedCalendarEventId: string | null = null;
            if (addExpense && cost > 0) {
                linkedExpenseId = await createHealthExpense(cost, new Date(req.body.date), req.body.description || 'Healthcare', userId, tx);
            }
            if (addToCalendar && req.body.nextCheckupDate) {
                linkedCalendarEventId = await createCheckupCalendarEvent(req.body.nextCheckupDate, person?.name ?? 'Unknown', req.body.location, req.body.description, userId, tx);
            }
            return tx.healthLog.create({
                data: {
                    ...logData,
                    date: new Date(req.body.date),
                    nextCheckupDate: req.body.nextCheckupDate ? new Date(req.body.nextCheckupDate) : null,
                    linkedExpenseId,
                    linkedCalendarEventId,
                    personId,
                    userId,
                },
                include: { files: true },
            });
        });
        sendCreated(res, log);
    } catch (err) { next(err); }
});

router.patch('/:personId/logs/:logId', validate(updateHealthLogSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const logId = paramStr(req, 'logId');
        const existing = await assertLogOwner(logId, personId, req.user!.userId);
        const { addExpense, addToCalendar, ...logUpdateData } = req.body;
        const userId = req.user!.userId;

        const updateData: any = {
            ...logUpdateData,
            date: req.body.date ? new Date(req.body.date) : undefined,
            nextCheckupDate: req.body.nextCheckupDate === null ? null : req.body.nextCheckupDate ? new Date(req.body.nextCheckupDate) : undefined,
        };

        // Handle expense toggle
        if (addExpense === true && !existing.linkedExpenseId) {
            const cost = req.body.cost ? Number(req.body.cost) : (existing.cost ?? 0);
            const expId = await createHealthExpense(cost, new Date(req.body.date ?? existing.date), req.body.description ?? existing.description ?? 'Healthcare', userId);
            updateData.linkedExpenseId = expId;
        } else if (addExpense === false && existing.linkedExpenseId) {
            try { await prisma.expense.delete({ where: { id: existing.linkedExpenseId } }); } catch { /* already deleted */ }
            updateData.linkedExpenseId = null;
        }

        // Handle calendar toggle
        if (addToCalendar === true && !existing.linkedCalendarEventId) {
            const person = await prisma.healthPerson.findUnique({ where: { id: personId }, select: { name: true } });
            const checkupDate = req.body.nextCheckupDate ?? existing.nextCheckupDate?.toISOString();
            if (checkupDate) {
                const evId = await createCheckupCalendarEvent(checkupDate, person?.name ?? 'Unknown', req.body.location ?? existing.location ?? undefined, req.body.description ?? existing.description ?? undefined, userId);
                updateData.linkedCalendarEventId = evId;
            }
        } else if (addToCalendar === false && existing.linkedCalendarEventId) {
            try { await prisma.calendarEvent.delete({ where: { id: existing.linkedCalendarEventId } }); } catch { /* already deleted */ }
            updateData.linkedCalendarEventId = null;
        }

        const updated = await prisma.healthLog.update({
            where: { id: logId },
            data: updateData,
            include: { files: true },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:personId/logs/:logId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const logId = paramStr(req, 'logId');
        await assertLogOwner(logId, personId, req.user!.userId);
        const files = await prisma.healthLogFile.findMany({ where: { logId } });
        for (const f of files) { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); }
        await prisma.healthLog.delete({ where: { id: logId } });
        sendMessage(res, 'Health log deleted');
    } catch (err) { next(err); }
});

// ─── Log file upload ──────────────────────────────────────────────────────────

router.post('/:personId/logs/:logId/files', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const personId = paramStr(req, 'personId');
        const logId = paramStr(req, 'logId');
        await assertLogOwner(logId, personId, req.user!.userId);
        if (!req.file) throw new ValidationError('No file uploaded');
        const file = await prisma.healthLogFile.create({
            data: {
                logId,
                originalName: req.file.originalname,
                storedName: req.file.filename,
                mimeType: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
                label: req.body.label || null,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, file);
    } catch (err) { next(err); }
});

export default router;
