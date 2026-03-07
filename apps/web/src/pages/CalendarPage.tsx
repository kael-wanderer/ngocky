import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Calendar as CalIcon, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';

export default function CalendarPage() {
    const qc = useQueryClient();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showCreate, setShowCreate] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', allDay: false, location: '', color: '#4f46e5', isShared: true });

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data } = useQuery({
        queryKey: ['calendar', format(currentMonth, 'yyyy-MM')],
        queryFn: async () => (await api.get(`/calendar?startFrom=${monthStart.toISOString()}&startTo=${monthEnd.toISOString()}&limit=100`)).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/calendar', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setShowCreate(false); },
    });

    const events = data || [];
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const today = new Date();

    const getEventsForDay = (day: Date) => events.filter((e: any) => isSameDay(new Date(e.startDate), day));

    const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <CalIcon className="w-6 h-6" style={{ color: '#7c3aed' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Calendar</h2>
                </div>
                <button className="btn-primary" onClick={() => { setShowCreate(true); setForm({ ...form, startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }); }}>
                    <Plus className="w-4 h-4" /> New Event
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Create Event</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = { ...form, startDate: new Date(form.startDate).toISOString() };
                            if (form.endDate) body.endDate = new Date(form.endDate).toISOString();
                            else delete body.endDate;
                            createMut.mutate(body);
                        }} className="space-y-4">
                            <div><label className="label">Title <span className="text-red-500">*</span></label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Start</label><input type="datetime-local" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                                <div><label className="label">End</label><input type="datetime-local" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                            </div>
                            <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Color</label><input type="color" className="input h-10 p-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
                                <div className="flex items-end gap-2 pb-1">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="rounded" /> All day
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} className="rounded" /> Shared
                                    </label>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>Create Event</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{format(currentMonth, 'MMMM yyyy')}</h3>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-ghost p-2"><ChevronRight className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <div className="lg:col-span-2 card p-4">
                    <div className="grid grid-cols-7 gap-px mb-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                            <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px">
                        {days.map((day) => {
                            const dayEvents = getEventsForDay(day);
                            const isToday = isSameDay(day, today);
                            const inMonth = isSameMonth(day, currentMonth);
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`aspect-square p-1 rounded-lg text-sm transition-all relative ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-50'
                                        }`}
                                    style={{
                                        color: inMonth ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                        opacity: inMonth ? 1 : 0.4,
                                        ...(isSelected ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}),
                                    }}
                                >
                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${isToday ? 'text-white' : ''
                                        }`} style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <div className="flex justify-center gap-0.5 mt-0.5">
                                            {dayEvents.slice(0, 3).map((e: any, i: number) => (
                                                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || 'var(--color-primary)' }} />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Day Detail */}
                <div className="card p-4">
                    <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                        {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
                    </h4>
                    {selectedDate && selectedEvents.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events</p>
                    )}
                    <div className="space-y-2">
                        {selectedEvents.map((e: any) => (
                            <div key={e.id} className="p-3 rounded-lg border-l-4" style={{ borderColor: e.color || 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}>
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    {e.allDay ? 'All day' : format(new Date(e.startDate), 'h:mm a')}
                                    {e.endDate && !e.allDay && ` – ${format(new Date(e.endDate), 'h:mm a')}`}
                                </p>
                                {e.location && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>📍 {e.location}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
