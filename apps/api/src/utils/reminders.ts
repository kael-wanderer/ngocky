import { PeriodType, ReminderUnit } from '@prisma/client';
import { ValidationError } from './errors';

type ReminderInput = {
    [key: string]: unknown;
    notificationEnabled?: boolean | null;
    reminderOffsetUnit?: ReminderUnit | null;
    reminderOffsetValue?: number | null;
    notificationDate?: string | Date | null;
    notificationTime?: string | null;
    notificationCooldownHours?: number | null;
    lastNotificationSentAt?: Date | null;
};

type ReminderResult = {
    notificationEnabled: boolean;
    reminderOffsetUnit: ReminderUnit | null;
    reminderOffsetValue: number | null;
    notificationDate: Date | null;
    notificationTime: string | null;
    notificationCooldownHours: number;
    lastNotificationSentAt: Date | null;
};

type ReminderOptions = {
    anchorDate?: string | Date | null;
    anchorLabel: string;
    current?: ReminderInput | null;
};

export function getGoalPeriodStart(periodType: PeriodType, referenceDate = new Date()): Date {
    if (periodType === 'WEEKLY') {
        const day = referenceDate.getDay();
        const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff, 0, 0, 0, 0);
    }

    if (periodType === 'QUARTERLY') {
        const quarterStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3;
        return new Date(referenceDate.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
    }

    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
}

export function getGoalPeriodEnd(currentPeriodStart: Date, periodType: PeriodType): Date {
    const end = new Date(currentPeriodStart);
    if (periodType === 'MONTHLY') end.setMonth(end.getMonth() + 1);
    else if (periodType === 'QUARTERLY') end.setMonth(end.getMonth() + 3);
    else end.setDate(end.getDate() + 7);
    return end;
}

export function resolveReminderFields(input: ReminderInput, options: ReminderOptions): ReminderResult {
    const notificationEnabled = !!input.notificationEnabled;
    const notificationCooldownHours = Math.max(1, input.notificationCooldownHours ?? 24);

    if (!notificationEnabled) {
        return {
            notificationEnabled: false,
            reminderOffsetUnit: null,
            reminderOffsetValue: null,
            notificationDate: null,
            notificationTime: null,
            notificationCooldownHours,
            lastNotificationSentAt: null,
        };
    }

    const reminderOffsetUnit = input.reminderOffsetUnit ?? null;
    if (!reminderOffsetUnit || !['HOURS', 'DAYS', 'ON_DATE'].includes(reminderOffsetUnit)) {
        throw new ValidationError('Notification type is required');
    }

    const notificationTime = normalizeNotificationTime(input.notificationTime ?? extractTime(input.notificationDate) ?? null);
    if (!notificationTime) {
        throw new ValidationError('Notification time is required');
    }

    const comparisonAnchor = options.anchorDate ? toDate(options.anchorDate) : null;
    let notificationDate: Date | null = null;
    let reminderOffsetValue: number | null = null;

    if (reminderOffsetUnit === 'ON_DATE') {
        const sourceDate = toDate(input.notificationDate);
        if (!sourceDate) throw new ValidationError('Notification date is required');
        notificationDate = combineDateAndTime(sourceDate, notificationTime);
    } else {
        reminderOffsetValue = input.reminderOffsetValue ?? null;
        if (!reminderOffsetValue || reminderOffsetValue < 1) {
            throw new ValidationError('Reminder offset is required');
        }
        if (!comparisonAnchor) {
            throw new ValidationError(`${options.anchorLabel} is required when notification is enabled`);
        }

        const anchorDateTime = combineDateAndTime(comparisonAnchor, notificationTime);
        notificationDate = new Date(anchorDateTime);
        if (reminderOffsetUnit === 'HOURS') {
            notificationDate.setHours(notificationDate.getHours() - reminderOffsetValue);
        } else {
            notificationDate.setDate(notificationDate.getDate() - reminderOffsetValue);
        }
    }

    if (comparisonAnchor) {
        const cutoff = getReminderCutoff(comparisonAnchor);
        if (notificationDate >= cutoff) {
            throw new ValidationError(`Notification must be before ${options.anchorLabel.toLowerCase()}`);
        }
    }

    const scheduleChanged = hasReminderScheduleChanged(
        options.current,
        {
            notificationEnabled,
            reminderOffsetUnit,
            reminderOffsetValue,
            notificationDate,
            notificationTime,
            notificationCooldownHours,
            lastNotificationSentAt: input.lastNotificationSentAt ?? null,
        },
    );

    return {
        notificationEnabled,
        reminderOffsetUnit,
        reminderOffsetValue,
        notificationDate,
        notificationTime,
        notificationCooldownHours,
        lastNotificationSentAt: scheduleChanged ? null : input.lastNotificationSentAt ?? null,
    };
}

export function isReminderDue(now: Date, item: { notificationDate: Date | null; lastNotificationSentAt?: Date | null; notificationCooldownHours?: number | null }) {
    if (!item.notificationDate) return false;
    if (item.notificationDate > now) return false;

    const cooldownHours = Math.max(1, item.notificationCooldownHours ?? 24);
    if (!item.lastNotificationSentAt) return true;

    return now.getTime() - item.lastNotificationSentAt.getTime() >= cooldownHours * 60 * 60 * 1000;
}

export function getReminderCutoff(anchorDate: Date) {
    if (
        anchorDate.getHours() === 0
        && anchorDate.getMinutes() === 0
        && anchorDate.getSeconds() === 0
        && anchorDate.getMilliseconds() === 0
    ) {
        const endOfDay = new Date(anchorDate);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay;
    }

    return anchorDate;
}

function hasReminderScheduleChanged(current: ReminderInput | null | undefined, next: ReminderResult) {
    if (!current) return true;

    return (
        !!current.notificationEnabled !== next.notificationEnabled
        || (current.reminderOffsetUnit ?? null) !== next.reminderOffsetUnit
        || (current.reminderOffsetValue ?? null) !== next.reminderOffsetValue
        || !datesEqual(toDate(current.notificationDate), next.notificationDate)
        || normalizeNotificationTime(current.notificationTime ?? extractTime(current.notificationDate) ?? null) !== next.notificationTime
        || (current.notificationCooldownHours ?? 24) !== next.notificationCooldownHours
    );
}

function datesEqual(a: Date | null, b: Date | null) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.getTime() === b.getTime();
}

function toDate(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function extractTime(value?: string | Date | null) {
    const date = toDate(value);
    if (!date) return null;
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeNotificationTime(value?: string | null) {
    if (!value) return null;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new ValidationError('Notification time must use HH:mm');
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) throw new ValidationError('Notification time must use HH:mm');
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function combineDateAndTime(date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    return next;
}
