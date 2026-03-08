import React from 'react';

export type NotificationState = {
    notificationEnabled: boolean;
    reminderOffsetUnit: string;
    reminderOffsetValue: number;
    notificationDate: string;
};

export const emptyNotification: NotificationState = {
    notificationEnabled: false,
    reminderOffsetUnit: 'DAYS',
    reminderOffsetValue: 1,
    notificationDate: '',
};

/** Call this in your submit handler to build the notification payload */
export function buildNotificationPayload(state: NotificationState): Record<string, any> {
    if (!state.notificationEnabled) return { notificationEnabled: false, notificationDate: null };
    const base: Record<string, any> = {
        notificationEnabled: true,
        reminderOffsetUnit: state.reminderOffsetUnit,
    };
    if (state.reminderOffsetUnit === 'ON_DATE') {
        base.notificationDate = state.notificationDate
            ? new Date(`${state.notificationDate}T00:00:00`).toISOString()
            : null;
    } else {
        base.reminderOffsetValue = state.reminderOffsetValue;
        base.notificationDate = null;
    }
    return base;
}

/** Populate notification state from an existing record */
export function loadNotificationState(record: any): NotificationState {
    return {
        notificationEnabled: !!record.notificationEnabled,
        reminderOffsetUnit: record.reminderOffsetUnit || 'DAYS',
        reminderOffsetValue: record.reminderOffsetValue || 1,
        notificationDate: record.notificationDate
            ? new Date(record.notificationDate).toISOString().split('T')[0]
            : '',
    };
}

export default function NotificationFields<T extends NotificationState>({
    form,
    setForm,
}: {
    form: T;
    setForm: React.Dispatch<React.SetStateAction<T>>;
}) {
    return (
        <>
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={form.notificationEnabled}
                    onChange={(e) => setForm({ ...form, notificationEnabled: e.target.checked })}
                />
                Notification
            </label>
            {form.notificationEnabled && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Type</label>
                        <select
                            className="input"
                            value={form.reminderOffsetUnit}
                            onChange={(e) => setForm({ ...form, reminderOffsetUnit: e.target.value })}
                        >
                            <option value="HOURS">Hours</option>
                            <option value="DAYS">Days</option>
                            <option value="ON_DATE">On Date</option>
                        </select>
                    </div>
                    <div>
                        {form.reminderOffsetUnit === 'ON_DATE' ? (
                            <>
                                <label className="label">Notification Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={form.notificationDate}
                                    onChange={(e) => setForm({ ...form, notificationDate: e.target.value })}
                                />
                            </>
                        ) : (
                            <>
                                <label className="label">
                                    {form.reminderOffsetUnit === 'DAYS' ? 'Days Before' : 'Hours Before'}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    className="input"
                                    value={form.reminderOffsetValue}
                                    onChange={(e) => setForm({ ...form, reminderOffsetValue: parseInt(e.target.value) || 1 })}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
