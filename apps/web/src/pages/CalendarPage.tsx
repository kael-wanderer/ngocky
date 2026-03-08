import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Calendar as CalIcon, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2, Pin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';

type CalendarView = 'today' | 'week' | 'month';

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h12}:${String(m).padStart(2, '0')}${period}` };
});

const emptyForm = {
    title: '',
    description: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    allDay: false,
    location: '',
    color: '#4f46e5',
    isShared: true,
    pinToDashboard: false,
    repeatFrequency: '',
    repeatEndType: '',
    repeatUntil: '',
    ...emptyNotification,
};

export default function CalendarPage() {
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [view, setView] = useState<CalendarView>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showCreate, setShowCreate] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const eventIdParam = searchParams.get('eventId');
    const dateParam = searchParams.get('date');

    const range = useMemo(() => {
        if (view === 'today') {
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            return { start, end };
        }
        if (view === 'week') {
            return {
                start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                end: endOfWeek(currentDate, { weekStartsOn: 1 }),
            };
        }
        return {
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate),
        };
    }, [currentDate, view]);

    const { data } = useQuery({
        queryKey: ['calendar', view, format(range.start, 'yyyy-MM-dd'), format(range.end, 'yyyy-MM-dd')],
        queryFn: async () => (await api.get(`/calendar?startFrom=${range.start.toISOString()}&startTo=${range.end.toISOString()}&limit=200`)).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/calendar', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setShowCreate(false); setForm({ ...emptyForm }); },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/calendar/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['calendar'] });
            setEditingEvent(null);
            setForm({ ...emptyForm });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/calendar/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    });

    const events = data || [];
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const today = new Date();

    const getEventsForDay = (day: Date) => events.filter((e: any) => isSameDay(new Date(e.startDate), day));
    const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];
    const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });

    const openCreate = () => {
        setEditingEvent(null);
        const base = selectedDate || new Date();
        const now = new Date();
        let h = now.getHours();
        let m = Math.ceil(now.getMinutes() / 15) * 15;
        if (m >= 60) { h += 1; m = 0; }
        if (h >= 24) h = 23;
        const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endH = h + 1 > 23 ? 23 : h + 1;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setForm({
            ...emptyForm,
            startDate: format(base, 'yyyy-MM-dd'),
            startTime,
            endDate: format(base, 'yyyy-MM-dd'),
            endTime,
        });
        setShowCreate(true);
    };

    const openEdit = (event: any) => {
        setShowCreate(false);
        setEditingEvent(event);
        setForm({
            title: event.title || '',
            description: event.description || '',
            startDate: format(new Date(event.startDate), 'yyyy-MM-dd'),
            startTime: format(new Date(event.startDate), 'HH:mm'),
            endDate: event.endDate ? format(new Date(event.endDate), 'yyyy-MM-dd') : '',
            endTime: event.endDate ? format(new Date(event.endDate), 'HH:mm') : '',
            allDay: !!event.allDay,
            location: event.location || '',
            color: event.color || '#4f46e5',
            isShared: !!event.isShared,
            pinToDashboard: !!event.pinToDashboard,
            repeatFrequency: event.repeatFrequency || '',
            repeatEndType: event.repeatEndType || '',
            repeatUntil: event.repeatUntil ? format(new Date(event.repeatUntil), 'yyyy-MM-dd') : '',
            ...loadNotificationState(event),
        });
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this event?')) deleteMut.mutate(id);
    };

    const getSourceId = (event: any) => event.sourceEventId || event.id;

    const togglePin = (event: any) => {
        updateMut.mutate({ id: getSourceId(event), body: { pinToDashboard: !event.pinToDashboard } });
    };

    useEffect(() => {
        if (dateParam) {
            const parsed = new Date(dateParam);
            if (!Number.isNaN(parsed.getTime())) {
                setSelectedDate(parsed);
                setCurrentDate(parsed);
            }
        }
    }, [dateParam]);

    useEffect(() => {
        if (!eventIdParam || !events.length) return;
        const event = events.find((e: any) => e.id === eventIdParam || e.sourceEventId === eventIdParam);
        if (!event) return;
        setSelectedDate(new Date(event.startDate));
        setCurrentDate(new Date(event.startDate));
        openEdit(event);
    }, [eventIdParam, events]);

    useEffect(() => {
        if (!showCreate && !editingEvent && (eventIdParam || dateParam)) {
            setSearchParams({});
        }
    }, [showCreate, editingEvent, eventIdParam, dateParam, setSearchParams]);

    const headerLabel = view === 'today'
        ? format(currentDate, 'EEEE, MMMM d, yyyy')
        : view === 'week'
            ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
            : format(currentDate, 'MMMM yyyy');

    const shiftBackward = () => {
        if (view === 'today') setCurrentDate(addDays(currentDate, -1));
        else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
        else setCurrentDate(subMonths(currentDate, 1));
    };

    const shiftForward = () => {
        if (view === 'today') setCurrentDate(addDays(currentDate, 1));
        else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
        else setCurrentDate(addMonths(currentDate, 1));
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <CalIcon className="w-6 h-6" style={{ color: '#7c3aed' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Calendar</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        {(['today', 'week', 'month'] as CalendarView[]).map((mode) => (
                            <button key={mode} onClick={() => setView(mode)} className={`px-3 py-2 text-sm ${view === mode ? 'bg-gray-100' : ''}`}>{mode[0].toUpperCase() + mode.slice(1)}</button>
                        ))}
                    </div>
                    <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> New Event</button>
                </div>
            </div>

            {(showCreate || editingEvent) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCreate(false); setEditingEvent(null); } }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
                            <button onClick={() => { setShowCreate(false); setEditingEvent(null); }}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = {
                                ...form,
                                startDate: new Date(`${form.startDate}T${form.startTime}`).toISOString(),
                                repeatFrequency: form.repeatFrequency || null,
                                repeatEndType: form.repeatFrequency ? (form.repeatEndType || 'NEVER') : null,
                                ...buildNotificationPayload(form),
                            };
                            if (form.endDate) body.endDate = new Date(`${form.endDate}T${form.endTime || form.startTime}`).toISOString();
                            else delete body.endDate;
                            if (form.repeatFrequency && form.repeatEndType === 'ON_DATE' && form.repeatUntil) body.repeatUntil = new Date(`${form.repeatUntil}T23:59:59.999`).toISOString();
                            else body.repeatUntil = null;
                            if (editingEvent) updateMut.mutate({ id: getSourceId(editingEvent), body });
                            else createMut.mutate(body);
                        }} className="space-y-4">
                            <div><label className="label">Title <span className="text-red-500">*</span></label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Start Date <span className="text-red-500">*</span></label>
                                    <label className="relative block cursor-pointer">
                                        <span className="input block text-sm">{form.startDate ? format(new Date(`${form.startDate}T00:00`), 'MMM dd, yyyy') : 'Select date'}</span>
                                        <input type="date" required className="absolute inset-0 opacity-0 w-full cursor-pointer" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                                    </label>
                                </div>
                                <div>
                                    <label className="label">Start Time</label>
                                    <select className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">End Date</label>
                                    <label className="relative block cursor-pointer">
                                        <span className="input block text-sm">{form.endDate ? format(new Date(`${form.endDate}T00:00`), 'MMM dd, yyyy') : 'None'}</span>
                                        <input type="date" className="absolute inset-0 opacity-0 w-full cursor-pointer" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                                    </label>
                                </div>
                                <div>
                                    <label className="label">End Time</label>
                                    <select className="input" value={form.endTime} disabled={!form.endDate} onChange={(e) => setForm({ ...form, endTime: e.target.value })}>
                                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Repeat</label>
                                    <select className="input" value={form.repeatFrequency} onChange={(e) => setForm({ ...form, repeatFrequency: e.target.value, repeatEndType: e.target.value ? (form.repeatEndType || 'NEVER') : '', repeatUntil: e.target.value ? form.repeatUntil : '' })}>
                                        <option value="">Does not repeat</option>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                {form.repeatFrequency && (
                                    <div>
                                        <label className="label">End Repeat</label>
                                        <select className="input" value={form.repeatEndType || 'NEVER'} onChange={(e) => setForm({ ...form, repeatEndType: e.target.value, repeatUntil: e.target.value === 'ON_DATE' ? form.repeatUntil : '' })}>
                                            <option value="NEVER">Never</option>
                                            <option value="ON_DATE">On date</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            {form.repeatFrequency && form.repeatEndType === 'ON_DATE' && (
                                <div>
                                    <label className="label">Repeat Until</label>
                                    <input type="date" min={form.startDate || format(new Date(), 'yyyy-MM-dd')} className="input" value={form.repeatUntil} onChange={(e) => setForm({ ...form, repeatUntil: e.target.value })} />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Color</label><input type="color" className="input h-10 p-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="rounded" /> All day</label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} className="rounded" /> Shared</label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.pinToDashboard} onChange={(e) => setForm({ ...form, pinToDashboard: e.target.checked })} className="rounded" /> Pin to dashboard</label>
                                </div>
                            </div>
                            <NotificationFields form={form} setForm={setForm} />
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending || updateMut.isPending}>{editingEvent ? 'Save Changes' : 'Create Event'}</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <button onClick={shiftBackward} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{headerLabel}</h3>
                <button onClick={shiftForward} className="btn-ghost p-2"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {view === 'month' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                const inMonth = isSameMonth(day, currentDate);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                return (
                                    <button key={day.toISOString()} onClick={() => setSelectedDate(day)} className={`aspect-square p-1 rounded-lg text-sm transition-all relative ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-50'}`} style={{ color: inMonth ? 'var(--color-text)' : 'var(--color-text-secondary)', opacity: inMonth ? 1 : 0.4, ...(isSelected ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}) }}>
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${isToday ? 'text-white' : ''}`} style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}>{format(day, 'd')}</span>
                                        {dayEvents.length > 0 && (
                                            <div className="flex justify-center gap-0.5 mt-0.5">{dayEvents.slice(0, 3).map((e: any, i: number) => (<div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || 'var(--color-primary)' }} />))}</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card p-4">
                        <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>{selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}</h4>
                        {selectedDate && selectedEvents.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events</p>}
                        <div className="space-y-2">
                            {selectedEvents.map((e: any) => (
                                <div key={e.id} className="p-3 rounded-lg border-l-4" style={{ borderColor: e.color || 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                                {e.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                            </div>
                                            {e.createdBy?.name && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Owner: {e.createdBy.name}</p>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button className={`p-1 ${e.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin event" onClick={() => togglePin(e)}><Pin className="w-3.5 h-3.5" /></button>
                                            <button className="p-1 hover:text-indigo-500" title="Edit event" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></button>
                                            <button className="p-1 hover:text-red-500" title="Delete event" onClick={() => handleDelete(getSourceId(e))}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{e.allDay ? 'All day' : format(new Date(e.startDate), 'h:mm a')}{e.endDate && !e.allDay && ` - ${format(new Date(e.endDate), 'h:mm a')}`}</p>
                                    {e.repeatFrequency && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Repeats: {e.repeatFrequency.toLowerCase()}</p>}
                                    {e.location && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Location: {e.location}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {(view === 'today' || view === 'week') && (
                <div className="card p-5 space-y-4">
                    {(view === 'today' ? [currentDate] : weekDays).map((day) => {
                        const items = getEventsForDay(day);
                        return (
                            <div key={day.toISOString()} className="space-y-2">
                                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{format(day, view === 'today' ? 'EEEE, MMMM d' : 'EEE, MMM d')}</h4>
                                {items.length === 0 ? (
                                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events</p>
                                ) : items.map((e: any) => (
                                    <div key={e.id} className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                                    {e.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                                </div>
                                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{e.allDay ? 'All day' : format(new Date(e.startDate), 'h:mm a')}{e.endDate && !e.allDay ? ` - ${format(new Date(e.endDate), 'h:mm a')}` : ''}</p>
                                                {e.createdBy?.name && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Owner: {e.createdBy.name}</p>}
                                                {e.location && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Location: {e.location}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button className={`p-1 ${e.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} onClick={() => togglePin(e)}><Pin className="w-3.5 h-3.5" /></button>
                                                <button className="p-1 hover:text-indigo-500" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></button>
                                                <button className="p-1 hover:text-red-500" onClick={() => handleDelete(getSourceId(e))}><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                        {e.repeatFrequency && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Repeats: {e.repeatFrequency.toLowerCase()}</p>}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
