import { prisma } from '../../../config/database';
import { escapeMd, localDayToUTCRange, formatLocalDateTime } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

const LOG_TYPE_LABEL: Record<string, string> = {
    REGULAR_CHECKUP: 'Regular Checkup',
    DOCTOR_VISIT: 'Doctor Visit',
    EMERGENCY: 'Emergency',
    VACCINATION: 'Vaccination',
    PRESCRIPTION: 'Prescription',
    LAB_RESULT: 'Lab Result',
    OTHER: 'Other',
};

/**
 * query_healthbook — List health persons.
 * entities: { personName?: string }
 */
export async function resolveHealthbookQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const personName = (entities.personName as string | undefined)?.trim();

    const where: any = {
        OR: [{ userId: ctx.userId }, { isShared: true }],
    };
    if (personName) where.name = { contains: personName, mode: 'insensitive' };

    const persons = await prisma.healthPerson.findMany({
        where,
        include: { _count: { select: { logs: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (persons.length === 0) {
        return { reply: 'No health profiles found\\.', requiresConfirmation: false };
    }

    const lines = persons.map(p => {
        const dob = p.dateOfBirth
            ? ` \\(${escapeMd(p.dateOfBirth.toLocaleDateString('en-US', { timeZone: ctx.timezone, month: 'short', day: 'numeric', year: 'numeric' }))}\\)`
            : '';
        const blood = p.bloodType ? ` 🩸 ${escapeMd(p.bloodType)}` : '';
        const logs = ` · ${p._count.logs} log${p._count.logs !== 1 ? 's' : ''}`;
        return `👤 *${escapeMd(p.name)}*${dob}${blood}${escapeMd(logs)}`;
    });

    return {
        reply: `*Health Profiles:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}

/**
 * query_health_logs — List medical logs for a person.
 * entities: { personName: string (required), dateRange?: { from, to } }
 */
export async function resolveHealthLogsQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const personName = (entities.personName as string | undefined)?.trim();

    if (!personName) {
        return {
            reply: 'Which person\'s health logs? Reply with the name, or send cancel\\.',
            requiresConfirmation: true,
            pendingIntent: 'query_health_logs',
            pendingPayload: {
                kind: 'collect_field',
                prompt: 'Which person\'s health logs? Reply with the name, or send cancel\\.',
                parsedIntent: { intent: 'query_health_logs', confidence: 1, entities },
                field: 'personName',
            },
        };
    }

    const person = await prisma.healthPerson.findFirst({
        where: {
            name: { contains: personName, mode: 'insensitive' },
            OR: [{ userId: ctx.userId }, { isShared: true }],
        },
    });

    if (!person) {
        return {
            reply: `No health profile found for *${escapeMd(personName)}*\\.`,
            requiresConfirmation: false,
        };
    }

    const logWhere: any = { personId: person.id };

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        logWhere.date = { gte: start, lte: end };
    }

    const logs = await prisma.healthLog.findMany({
        where: logWhere,
        orderBy: [{ date: 'desc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (logs.length === 0) {
        return {
            reply: `No medical logs found for *${escapeMd(person.name)}*\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = logs.map(log => {
        const date = escapeMd(formatLocalDateTime(log.date, ctx.timezone, false));
        const type = escapeMd(LOG_TYPE_LABEL[log.type] ?? log.type);
        const loc = log.location ? ` @ ${escapeMd(log.location)}` : '';
        const doc = log.doctor ? ` · Dr\\. ${escapeMd(log.doctor)}` : '';
        const cost = log.cost != null ? ` · ${escapeMd(log.cost.toLocaleString('vi-VN'))} ₫` : '';
        return `🏥 *${date}* — ${type}${loc}${doc}${cost}`;
    });

    return {
        reply: `*Health logs for ${escapeMd(person.name)}:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
