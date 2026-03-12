import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Calendar as CalIcon, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2, Pin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';

type CalendarView = 'today' | 'week' | 'month';

const HOUR_HEIGHT = 64; // px per hour
const PX_PER_MIN = HOUR_HEIGHT / 60;
const GRID_HOURS = Array.from({ length: 24 }, (_, i) => i);

function layoutDayEvents(dayEvents: any[]) {
    const timed = dayEvents.filter((e) => !e.allDay);
    const sorted = [...timed].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const cols: any[][] = [];
    const layout: { event: any; col: number }[] = [];
    for (const event of sorted) {
        const eStart = new Date(event.startDate).getTime();
        let placed = false;
        for (let c = 0; c < cols.length; c++) {
            const last = cols[c][cols[c].length - 1];
            const lastEnd = last.endDate ? new Date(last.endDate).getTime() : new Date(last.startDate).getTime() + 3600000;
            if (eStart >= lastEnd) {
                cols[c].push(event);
                layout.push({ event, col: c });
                placed = true;
                break;
            }
        }
        if (!placed) {
            cols.push([event]);
            layout.push({ event, col: cols.length - 1 });
        }
    }
    const totalCols = Math.max(cols.length, 1);
    return layout.map((l) => ({ ...l, totalCols }));
}

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
    const [formError, setFormError] = useState('');
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

    const { data: cakeoData } = useQuery({
        queryKey: ['cakeos-calendar', format(range.start, 'yyyy-MM-dd'), format(range.end, 'yyyy-MM-dd')],
        queryFn: async () => (await api.get(`/cakeos?startFrom=${range.start.toISOString()}&startTo=${range.end.toISOString()}`)).data.data,
    });

    const { data: tasksData } = useQuery({
        queryKey: ['tasks-calendar'],
        queryFn: async () => (await api.get('/tasks?limit=200')).data.data,
    });

    const { data: houseworkData } = useQuery({
        queryKey: ['housework-calendar'],
        queryFn: async () => (await api.get('/housework?limit=200')).data.data,
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

    const calendarEvents = data || [];
    const cakeoEvents = (cakeoData || [])
        .filter((item: any) => item.showOnCalendar && item.startDate)
        .map((item: any) => ({ ...item, _source: 'cakeo', color: item.color || '#ec4899' }));
    const taskEvents = (tasksData || [])
        .filter((item: any) => item.showOnCalendar && item.dueDate)
        .filter((item: any) => {
            const dueDate = new Date(item.dueDate);
            return dueDate >= range.start && dueDate <= range.end;
        })
        .map((item: any) => ({
            ...item,
            _source: 'task',
            startDate: item.dueDate,
            endDate: item.dueDate,
            allDay: false,
            color: item.taskType === 'PAYMENT' ? '#f59e0b' : '#4f46e5',
        }));
    const houseworkEvents = (houseworkData || [])
        .filter((item: any) => item.showOnCalendar && item.nextDueDate)
        .filter((item: any) => {
            const dueDate = new Date(item.nextDueDate);
            return dueDate >= range.start && dueDate <= range.end;
        })
        .map((item: any) => ({
            ...item,
            _source: 'housework',
            startDate: item.nextDueDate,
            endDate: item.nextDueDate,
            allDay: false,
            color: '#059669',
        }));
    const events = [...calendarEvents, ...cakeoEvents, ...taskEvents, ...houseworkEvents];
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const today = new Date();

    const getEventsForDay = (day: Date) => events.filter((e: any) => isSameDay(new Date(e.startDate), day));
    const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];
    const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
    const viewDays = view === 'today' ? [currentDate] : weekDays;
    const currentTimePx = (() => { const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) * PX_PER_MIN; })();
    const timeGridRef = useRef<HTMLDivElement>(null);

    const openCreate = () => {
        setEditingEvent(null);
        setFormError('');
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
        setFormError('');
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

    useEffect(() => {
        if ((view === 'today' || view === 'week') && timeGridRef.current) {
            const n = new Date();
            const scrollTo = Math.max((n.getHours() * 60 + n.getMinutes()) * PX_PER_MIN - 150, 7 * HOUR_HEIGHT);
            setTimeout(() => { if (timeGridRef.current) timeGridRef.current.scrollTop = scrollTo; }, 0);
        }
    }, [view]);

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
                            setFormError('');
                            const startAt = new Date(`${form.startDate}T${form.startTime}`);
                            const endAt = form.endDate ? new Date(`${form.endDate}T${form.endTime || form.startTime}`) : null;
                            if (endAt && endAt <= startAt) {
                                setFormError('End time must be after start time.');
                                return;
                            }
                            const body: any = {
                                ...form,
                                startDate: startAt.toISOString(),
                                repeatFrequency: form.repeatFrequency || null,
                                repeatEndType: form.repeatFrequency ? (form.repeatEndType || 'NEVER') : null,
                                ...buildNotificationPayload(form),
                            };
                            if (endAt) body.endDate = endAt.toISOString();
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
                                        <option value="QUARTERLY">Quarterly</option>
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
                            {formError && (
                                <p className="text-sm text-red-500">{formError}</p>
                            )}
                            <NotificationFields form={form} setForm={setForm} />
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingEvent && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this event?')) {
                                                    deleteMut.mutate(getSourceId(editingEvent));
                                                    setEditingEvent(null);
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => { setShowCreate(false); setEditingEvent(null); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createMut.isPending || updateMut.isPending}>{editingEvent ? 'Save' : 'Create Event'}</button>
                                </div>
                            </div>
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
                                <div key={e.id} className="p-3 rounded-lg border-l-4" style={{ borderColor: e.color || 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }} onDoubleClick={() => { if (!e._source) openEdit(e); }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                                {e.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                            </div>
                                            {e._source === 'cakeo' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#fce7f3', color: '#ec4899' }}>Ca Keo</span>}
                                            {e._source === 'task' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#eef2ff', color: '#4338ca' }}>Task</span>}
                                            {e._source === 'housework' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>Housework</span>}
                                            {e.createdBy?.name && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Owner: {e.createdBy.name}</p>}
                                        </div>
                                        {!e._source && (
                                            <div className="flex items-center gap-1">
                                                <button className={`p-1 ${e.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin event" onClick={() => togglePin(e)}><Pin className="w-3.5 h-3.5" /></button>
                                                <button className="p-1 hover:text-indigo-500" title="Edit event" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></button>
                                                <button className="p-1 hover:text-red-500" title="Delete event" onClick={() => handleDelete(getSourceId(e))}><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        )}
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
                <div className="card overflow-hidden">
                    {/* Day headers */}
                    <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="w-14 flex-shrink-0" />
                        {viewDays.map((day) => {
                            const isDayToday = isSameDay(day, today);
                            return (
                                <div key={day.toISOString()} className="flex-1 text-center py-2 border-l" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>{format(day, 'EEE')}</div>
                                    <div className="inline-flex items-center justify-center w-9 h-9 rounded-full text-lg font-bold" style={isDayToday ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text)' }}>
                                        {format(day, 'd')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Scrollable time grid */}
                    <div ref={timeGridRef} className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
                        <div className="relative flex">
                            {/* Hour labels */}
                            <div className="w-14 flex-shrink-0 relative select-none">
                                {GRID_HOURS.map((h) => (
                                    <div key={h} style={{ height: HOUR_HEIGHT }}>
                                        {h > 0 && (
                                            <span className="block text-right pr-2 -mt-2.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {/* Day columns */}
                            {viewDays.map((day) => {
                                const dayEvts = getEventsForDay(day);
                                const isDayToday = isSameDay(day, today);
                                const laid = layoutDayEvents(dayEvts);
                                return (
                                    <div
                                        key={day.toISOString()}
                                        className="flex-1 relative border-l"
                                        style={{ borderColor: 'var(--color-border)' }}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('[data-event="1"]')) return;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const rawMin = Math.floor(y / PX_PER_MIN);
                                            const snapped = Math.floor(rawMin / 15) * 15;
                                            const h = Math.min(Math.floor(snapped / 60), 23);
                                            const m = snapped % 60;
                                            const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                            const endH = h + 1 > 23 ? 23 : h + 1;
                                            const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                            setEditingEvent(null);
                                            setFormError('');
                                            setSelectedDate(day);
                                            setForm({ ...emptyForm, startDate: format(day, 'yyyy-MM-dd'), startTime, endDate: format(day, 'yyyy-MM-dd'), endTime });
                                            setShowCreate(true);
                                        }}
                                    >
                                        {/* Hour lines */}
                                        {GRID_HOURS.map((h) => (
                                            <div key={h} className={h > 0 ? 'border-t' : ''} style={{ height: HOUR_HEIGHT, borderColor: 'var(--color-border)' }} />
                                        ))}
                                        {/* Current time indicator */}
                                        {isDayToday && (
                                            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: currentTimePx }}>
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                                                <div className="flex-1 h-px bg-red-500" />
                                            </div>
                                        )}
                                        {/* Timed events */}
                                        {laid.map(({ event: e, col, totalCols }) => {
                                            const start = new Date(e.startDate);
                                            const startMin = start.getHours() * 60 + start.getMinutes();
                                            const end = e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 3600000);
                                            const endMin = end.getHours() * 60 + end.getMinutes();
                                            const duration = Math.max(endMin - startMin, 30);
                                            const top = startMin * PX_PER_MIN;
                                            const height = duration * PX_PER_MIN;
                                            const colPct = 100 / totalCols;
                                            return (
                                                <div
                                                    key={e.id}
                                                    data-event="1"
                                                    className="absolute rounded overflow-hidden cursor-pointer z-10 hover:opacity-90 transition-opacity"
                                                    style={{
                                                        top: top + 1,
                                                        height: Math.max(height - 2, 20),
                                                        left: `calc(${col * colPct}% + 2px)`,
                                                        width: `calc(${colPct}% - 4px)`,
                                                        backgroundColor: e.color || 'var(--color-primary)',
                                                    }}
                                                    onClick={(ev) => { ev.stopPropagation(); if (!e._source) openEdit(e); }}
                                                >
                                                    <div className="px-1 py-0.5 overflow-hidden h-full">
                                                        <p className="text-[11px] font-semibold text-white leading-tight truncate">{e.title}</p>
                                                        {height > 30 && (
                                                            <p className="text-[10px] text-white/80 leading-tight">{format(start, 'h:mm a')}{e.endDate ? ` – ${format(end, 'h:mm a')}` : ''}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* All-day events (pinned at top of column) */}
                                        {dayEvts.filter((e: any) => e.allDay).map((e: any) => (
                                            <div
                                                key={`allday-${e.id}`}
                                                data-event="1"
                                                className="absolute left-0.5 right-0.5 z-10 rounded cursor-pointer hover:opacity-90 px-1 py-0.5"
                                                style={{ top: 2, backgroundColor: e.color || 'var(--color-primary)' }}
                                                onClick={(ev) => { ev.stopPropagation(); if (!e._source) openEdit(e); }}
                                            >
                                                <p className="text-[11px] font-semibold text-white leading-tight truncate">{e.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
