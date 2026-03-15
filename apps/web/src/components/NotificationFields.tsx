import React from 'react';
import { format } from 'date-fns';

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h12}:${String(m).padStart(2, '0')}${period}` };
});

export type NotificationState = {
    notificationEnabled: boolean;
    reminderOffsetUnit: string; // 'HOURS' | 'DAYS' | 'ON_DATE'
    reminderOffsetValue: number;
    notificationDate: string; // 'yyyy-MM-dd'
    notificationTime: string; // 'HH:mm'
};

export const emptyNotification: NotificationState = {
    notificationEnabled: false,
    reminderOffsetUnit: 'DAYS',
    reminderOffsetValue: 1,
    notificationDate: '',
    notificationTime: '09:00',
};

/** Call this in your submit handler to build the notification payload */
export function buildNotificationPayload(state: NotificationState): Record<string, any> {
    if (!state.notificationEnabled) {
        return {
            notificationEnabled: false,
            notificationDate: null,
            notificationTime: null,
        };
    }

    if (state.reminderOffsetUnit === 'ON_DATE') {
        const dateStr = state.notificationDate;
        const timeStr = state.notificationTime || '09:00';
        return {
            notificationEnabled: true,
            reminderOffsetUnit: 'ON_DATE',
            notificationDate: dateStr ? new Date(`${dateStr}T${timeStr}`).toISOString() : null,
            notificationTime: timeStr,
        };
    }

    return {
        notificationEnabled: true,
        reminderOffsetUnit: state.reminderOffsetUnit,
        reminderOffsetValue: state.reminderOffsetValue,
        notificationDate: null,
        notificationTime: state.notificationTime || '09:00',
    };
}

/** Populate notification state from an existing record */
export function loadNotificationState(record: any): NotificationState {
    return {
        notificationEnabled: !!record.notificationEnabled,
        reminderOffsetUnit: record.reminderOffsetUnit || 'DAYS',
        reminderOffsetValue: record.reminderOffsetValue || 1,
        notificationDate: record.notificationDate
            ? format(new Date(record.notificationDate), 'yyyy-MM-dd')
            : '',
        notificationTime: record.notificationTime
            || (record.notificationDate
            ? format(new Date(record.notificationDate), 'HH:mm')
            : '09:00'),
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
            <div
                className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer"
                style={{ borderColor: form.notificationEnabled ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.notificationEnabled ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }}
                onClick={() => setForm({ ...form, notificationEnabled: !form.notificationEnabled })}
            >
                <input
                    type="checkbox"
                    checked={form.notificationEnabled}
                    onChange={(e) => setForm({ ...form, notificationEnabled: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                />
                <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Notification</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Sends a reminder notification at your chosen date and time</p>
                </div>
            </div>
            {form.notificationEnabled && (
                <div className="space-y-3">
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
                    {form.reminderOffsetUnit === 'ON_DATE' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={form.notificationDate}
                                    onChange={(e) => setForm({ ...form, notificationDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Time</label>
                                <select
                                    className="input"
                                    value={form.notificationTime}
                                    onChange={(e) => setForm({ ...form, notificationTime: e.target.value })}
                                >
                                    {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
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
                            </div>
                            <div>
                                <label className="label">Time</label>
                                <select
                                    className="input"
                                    value={form.notificationTime}
                                    onChange={(e) => setForm({ ...form, notificationTime: e.target.value })}
                                >
                                    {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
