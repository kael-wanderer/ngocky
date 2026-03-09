export function buildVisibleCalendarEventWhere(userId: string) {
    return {
        OR: [
            { createdById: userId },
            { isShared: true },
            { participants: { some: { userId } } },
        ],
    };
}
