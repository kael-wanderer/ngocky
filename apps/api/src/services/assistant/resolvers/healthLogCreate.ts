import { prisma } from '../../../config/database';
import { escapeMd, formatLocalDateTime } from '../utils';
import type { ResolverContext, ResolverResult } from './types';

const VALID_TYPES = [
    'REGULAR_CHECKUP', 'DOCTOR_VISIT', 'EMERGENCY',
    'VACCINATION', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER',
];

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
 * create_health_log — Add a medical log entry for a person.
 *
 * Entities:
 *   personName: string (required)
 *   date?: YYYY-MM-DD (default today)
 *   type?: REGULAR_CHECKUP|DOCTOR_VISIT|EMERGENCY|VACCINATION|PRESCRIPTION|LAB_RESULT|OTHER
 *   location?: string
 *   doctor?: string
 *   symptoms?: string
 *   description?: string
 *   cost?: number (VND)
 */
export async function resolveHealthLogCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const personName = (entities.personName as string | undefined)?.trim();

    if (!personName) {
        return {
            reply: 'Which person is this medical log for? Reply with the name, or send cancel\\.',
            requiresConfirmation: true,
            pendingIntent: 'create_health_log',
            pendingPayload: {
                kind: 'collect_field',
                prompt: 'Which person is this medical log for? Reply with the name, or send cancel\\.',
                parsedIntent: { intent: 'create_health_log', confidence: 1, entities },
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
            reply: `No health profile found for *${escapeMd(personName)}*\\. Add them in the Healthbook first\\.`,
            requiresConfirmation: false,
        };
    }

    const dateStr = (entities.date as string | undefined) ?? ctx.today;
    const date = new Date(`${dateStr.slice(0, 10)}T12:00:00.000Z`);

    const rawType = (entities.type as string | undefined)?.toUpperCase();
    const type = rawType && VALID_TYPES.includes(rawType) ? rawType : 'DOCTOR_VISIT';

    const location = (entities.location as string | undefined)?.trim() ?? null;
    const doctor = (entities.doctor as string | undefined)?.trim() ?? null;
    const symptoms = (entities.symptoms as string | undefined)?.trim() ?? null;
    const description = (entities.description as string | undefined)?.trim() ?? null;
    const cost = typeof entities.cost === 'number' && entities.cost > 0 ? entities.cost : null;

    await prisma.healthLog.create({
        data: {
            personId: person.id,
            date,
            type: type as any,
            location,
            doctor,
            symptoms,
            description,
            cost,
            userId: ctx.userId,
        },
    });

    const typeLabel = LOG_TYPE_LABEL[type] ?? type;
    const dateLabel = escapeMd(formatLocalDateTime(date, ctx.timezone, false));
    const parts: string[] = [];
    if (location) parts.push(`@ ${escapeMd(location)}`);
    if (doctor) parts.push(`Dr\\. ${escapeMd(doctor)}`);
    if (cost != null) parts.push(`${escapeMd(cost.toLocaleString('vi-VN'))} ₫`);
    const detail = parts.length > 0 ? ` · ${parts.join(' · ')}` : '';

    return {
        reply: `✅ Health log added for *${escapeMd(person.name)}*\n🏥 ${escapeMd(typeLabel)} on ${dateLabel}${detail}`,
        requiresConfirmation: false,
    };
}
