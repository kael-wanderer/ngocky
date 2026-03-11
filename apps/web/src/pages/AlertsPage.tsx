import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Bell, BellRing, Copy, FileText, Info, Mail, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CONDITIONS_BY_MODULE: Record<string, { value: string; label: string; hasThreshold?: boolean }[]> = {
    GOAL: [
        { value: 'PROGRESS_BELOW', label: 'Progress below (%)', hasThreshold: true },
        { value: 'OVERDUE', label: 'Overdue' },
    ],
    TASK: [
        { value: 'OVERDUE', label: 'Overdue' },
        { value: 'DUE_TODAY', label: 'Due Today' },
    ],
    HOUSEWORK: [
        { value: 'OVERDUE', label: 'Overdue' },
        { value: 'DUE_TODAY', label: 'Due Today' },
    ],
    EXPENSE: [
        { value: 'THRESHOLD_EXCEEDED', label: 'Budget Exceeded', hasThreshold: true },
    ],
    CALENDAR: [
        { value: 'DUE_TODAY', label: 'Due Today' },
    ],
    ASSETS: [
        { value: 'MAINTENANCE_DUE', label: 'Maintenance Due' },
    ],
};

const emptyRuleForm = () => ({
    name: '',
    moduleType: 'GOAL',
    frequency: 'WEEKLY',
    dayOfWeek: 3,
    dayOfMonth: 1,
    time: '08:00',
    conditionType: 'PROGRESS_BELOW',
    conditionValue: '50',
    active: true,
});

const SECTIONS_BY_TYPE: Record<string, { key: string; label: string }[]> = {
    WEEKLY_SUMMARY: [
        { key: 'GOALS', label: 'Goals' },
        { key: 'PROJECT', label: 'Project' },
        { key: 'TASKS', label: 'Task' },
        { key: 'HOUSEWORK', label: 'Housework' },
        { key: 'CALENDAR', label: 'Calendar Events' },
        { key: 'EXPENSES', label: 'Expenses' },
        { key: 'ASSETS', label: 'Appliances & Devices' },
        { key: 'LEARNING', label: 'Learning' },
        { key: 'IDEAS', label: 'Ideas' },
    ],
    NEXT_WEEK_TASKS: [
        { key: 'GOALS', label: 'Goals' },
        { key: 'PROJECT', label: 'Project' },
        { key: 'TASKS', label: 'Task' },
        { key: 'HOUSEWORK', label: 'Housework' },
        { key: 'CALENDAR', label: 'Calendar Events' },
    ],
    TODAY_TASKS: [
        { key: 'GOALS', label: 'Goals' },
        { key: 'PROJECT', label: 'Project' },
        { key: 'TASKS', label: 'Task' },
        { key: 'HOUSEWORK', label: 'Housework' },
        { key: 'CALENDAR', label: 'Calendar Events' },
    ],
    TOMORROW_TASKS: [
        { key: 'GOALS', label: 'Goals' },
        { key: 'PROJECT', label: 'Project' },
        { key: 'TASKS', label: 'Task' },
        { key: 'HOUSEWORK', label: 'Housework' },
        { key: 'CALENDAR', label: 'Calendar Events' },
    ],
};

const REPORT_TYPE_LABELS: Record<string, string> = {
    WEEKLY_SUMMARY: 'Weekly Summary',
    SUMMARY: 'Weekly Summary',
    NEXT_WEEK_TASKS: 'Next Week Tasks',
    TODAY_TASKS: 'Today Tasks',
    TOMORROW_TASKS: 'Tomorrow Tasks',
};

function getDefaultSections(reportType: string) {
    if (reportType === 'WEEKLY_SUMMARY') {
        return ['GOALS', 'PROJECT', 'TASKS', 'HOUSEWORK', 'CALENDAR', 'EXPENSES'];
    }
    return (SECTIONS_BY_TYPE[reportType] || []).map(({ key }) => key);
}

function getDefaultFrequency(reportType: string) {
    if (reportType === 'TODAY_TASKS' || reportType === 'TOMORROW_TASKS') return 'ONE_TIME';
    return 'WEEKLY';
}

function normalizeReportFrequency(frequency?: string) {
    return frequency === 'NONE' ? 'ONE_TIME' : (frequency || 'WEEKLY');
}

const emptyReportForm = (reportType = 'WEEKLY_SUMMARY') => ({
    name: '',
    reportType,
    frequency: getDefaultFrequency(reportType),
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '08:00',
    sections: getDefaultSections(reportType),
    active: true,
});

type AlertsPageProps = {
    forcedTab?: 'RULES' | 'REPORTS';
};

export default function AlertsPage({ forcedTab }: AlertsPageProps) {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'RULES' | 'REPORTS'>(forcedTab || 'RULES');
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [editingReport, setEditingReport] = useState<any>(null);
    const [ruleForm, setRuleForm] = useState(emptyRuleForm());
    const [reportForm, setReportForm] = useState(emptyReportForm());
    const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null);
    const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
    const [draggingReportId, setDraggingReportId] = useState<string | null>(null);
    const [dragOverReportId, setDragOverReportId] = useState<string | null>(null);
    const showTabSwitcher = !forcedTab;

    React.useEffect(() => {
        if (forcedTab && activeTab !== forcedTab) {
            setActiveTab(forcedTab);
        }
    }, [forcedTab, activeTab]);

    const { data: rules, isLoading: rulesLoading } = useQuery({
        queryKey: ['alert-rules'],
        queryFn: async () => (await api.get('/alerts')).data.data,
    });

    const createRuleMut = useMutation({
        mutationFn: (body: any) => api.post('/alerts', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); closeRuleModal(); },
    });

    const updateRuleMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/alerts/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); closeRuleModal(); },
    });

    const toggleRuleMut = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/alerts/${id}`, { active }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
    });

    const deleteRuleMut = useMutation({
        mutationFn: (id: string) => api.delete(`/alerts/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
    });

    const reorderRuleMut = useMutation({
        mutationFn: (ids: string[]) => api.post('/alerts/reorder', { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
    });

    const { data: reports, isLoading: reportsLoading } = useQuery({
        queryKey: ['scheduled-reports'],
        queryFn: async () => (await api.get('/scheduled-reports')).data.data,
    });
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/settings/profile')).data.data,
    });

    const createReportMut = useMutation({
        mutationFn: (body: any) => api.post('/scheduled-reports', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-reports'] }); closeReportModal(); },
    });

    const updateReportMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/scheduled-reports/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-reports'] }); closeReportModal(); },
    });

    const toggleReportMut = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/scheduled-reports/${id}`, { active }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-reports'] }),
    });

    const deleteReportMut = useMutation({
        mutationFn: (id: string) => api.delete(`/scheduled-reports/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-reports'] }),
    });

    const reorderReportMut = useMutation({
        mutationFn: (ids: string[]) => api.post('/scheduled-reports/reorder', { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-reports'] }),
    });

    function openCreateRule() {
        setEditingRule(null);
        setRuleForm(emptyRuleForm());
        setShowRuleModal(true);
    }

    function openEditRule(rule: any) {
        setEditingRule(rule);
        const mod = rule.moduleType || 'GOAL';
        setRuleForm({
            name: rule.name || '',
            moduleType: mod,
            frequency: rule.frequency || 'WEEKLY',
            dayOfWeek: rule.dayOfWeek ?? 3,
            dayOfMonth: rule.dayOfMonth ?? 1,
            time: rule.time || '08:00',
            conditionType: rule.conditionType || (CONDITIONS_BY_MODULE[mod]?.[0]?.value ?? 'OVERDUE'),
            conditionValue: rule.conditionValue || '',
            active: rule.active ?? true,
        });
        setShowRuleModal(true);
    }

    function duplicateRule(rule: any) {
        createRuleMut.mutate({
            name: `${rule.name} (Copy)`,
            moduleType: rule.moduleType,
            frequency: rule.frequency,
            dayOfWeek: rule.dayOfWeek,
            dayOfMonth: rule.dayOfMonth,
            time: rule.time,
            conditionType: rule.conditionType,
            conditionValue: rule.conditionValue || '',
            active: rule.active,
        });
    }

    function closeRuleModal() {
        setShowRuleModal(false);
        setEditingRule(null);
        setRuleForm(emptyRuleForm());
    }

    function openCreateReport() {
        setEditingReport(null);
        setReportForm(emptyReportForm());
        setShowReportModal(true);
    }

    function openEditReport(report: any) {
        setEditingReport(report);
        setReportForm({
            name: report.name || '',
            reportType: report.reportType || 'WEEKLY_SUMMARY',
            frequency: normalizeReportFrequency(report.frequency) || getDefaultFrequency(report.reportType || 'WEEKLY_SUMMARY'),
            dayOfWeek: report.dayOfWeek ?? 1,
            dayOfMonth: report.dayOfMonth ?? 1,
            time: report.time || '08:00',
            sections: report.sections?.length ? report.sections : getDefaultSections(report.reportType || 'WEEKLY_SUMMARY'),
            active: report.active ?? true,
        });
        setShowReportModal(true);
    }

    function duplicateReport(report: any) {
        createReportMut.mutate({
            name: report.name ? `${report.name} (Copy)` : `${REPORT_TYPE_LABELS[report.reportType] || report.reportType} (Copy)`,
            reportType: report.reportType,
            frequency: normalizeReportFrequency(report.frequency),
            dayOfWeek: report.dayOfWeek,
            dayOfMonth: report.dayOfMonth,
            time: report.time,
            sections: report.sections?.length ? report.sections : getDefaultSections(report.reportType),
            active: report.active,
        });
    }

    function closeReportModal() {
        setShowReportModal(false);
        setEditingReport(null);
        setReportForm(emptyReportForm());
    }

    function handleRuleDrop(targetId: string) {
        if (!draggingRuleId || draggingRuleId === targetId) {
            setDraggingRuleId(null);
            setDragOverRuleId(null);
            return;
        }

        const ids = (rules || []).map((rule: any) => rule.id);
        const from = ids.indexOf(draggingRuleId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) return;

        const reordered = [...ids];
        reordered.splice(from, 1);
        reordered.splice(to, 0, draggingRuleId);
        reorderRuleMut.mutate(reordered);
        setDraggingRuleId(null);
        setDragOverRuleId(null);
    }

    function handleReportDrop(targetId: string) {
        if (!draggingReportId || draggingReportId === targetId) {
            setDraggingReportId(null);
            setDragOverReportId(null);
            return;
        }

        const ids = (reports || []).map((report: any) => report.id);
        const from = ids.indexOf(draggingReportId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) return;

        const reordered = [...ids];
        reordered.splice(from, 1);
        reordered.splice(to, 0, draggingReportId);
        reorderReportMut.mutate(reordered);
        setDraggingReportId(null);
        setDragOverReportId(null);
    }

    function openNotificationSettings() {
        navigate('/settings?tab=notifications');
    }

    function renderChannelIcons() {
        const channel = profile?.notificationChannel || 'EMAIL';
        const mailIcon = <Mail className="w-3.5 h-3.5 text-red-500" />;
        const telegramIcon = <Send className="w-3.5 h-3.5 text-sky-500" />;

        if (channel === 'BOTH') {
            return (
                <>
                    {telegramIcon}
                    {mailIcon}
                </>
            );
        }

        return channel === 'TELEGRAM' ? telegramIcon : mailIcon;
    }

    function getChannelLabel() {
        const channel = profile?.notificationChannel || 'EMAIL';
        if (channel === 'BOTH') return 'via Telegram + Email';
        if (channel === 'TELEGRAM') return 'via Telegram';
        return 'via Email';
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <BellRing className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeTab === 'RULES' ? 'Notifications' : 'Schedule Action'}</h2>
                </div>
                {showTabSwitcher && (
                    <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'RULES' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('RULES')} style={activeTab === 'RULES' ? { color: 'var(--color-primary)' } : {}}>Notification Settings</button>
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('REPORTS')} style={activeTab === 'REPORTS' ? { color: 'var(--color-primary)' } : {}}>Schedule Action</button>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-xs text-blue-800 leading-relaxed">
                    <strong>Schedule Action:</strong> Actions are delivered via your notification channel configured in Settings. Alert rules and scheduled actions can be edited or duplicated directly from this page.
                </div>
            </div>

            {activeTab === 'RULES' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Notification Rules</h3>
                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateRule}><Plus className="w-3.5 h-3.5" /> New Notification</button>
                    </div>

                    {rulesLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {(rules || []).map((rule: any) => (
                                <div
                                    key={rule.id}
                                    className={`card p-5 group transition-all cursor-grab active:cursor-grabbing ${dragOverRuleId === rule.id ? 'ring-2 shadow-lg' : ''} ${!rule.active ? 'opacity-60 bg-gray-50' : ''}`}
                                    style={dragOverRuleId === rule.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                    draggable
                                    onDoubleClick={() => openEditRule(rule)}
                                    onDragStart={() => setDraggingRuleId(rule.id)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverRuleId(rule.id); }}
                                    onDragLeave={() => setDragOverRuleId(null)}
                                    onDrop={() => handleRuleDrop(rule.id)}
                                    onDragEnd={() => { setDraggingRuleId(null); setDragOverRuleId(null); }}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-2 rounded-lg ${!rule.active ? 'bg-gray-200' : 'bg-primary/10'}`}>
                                            <Bell className={`w-4 h-4 ${!rule.active ? 'text-gray-400' : 'text-primary'}`} style={rule.active ? { color: 'var(--color-primary)' } : {}} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${rule.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`} onClick={() => toggleRuleMut.mutate({ id: rule.id, active: !rule.active })}>
                                                {rule.active ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{rule.name}</h4>
                                    <p className="text-[10px] font-medium mt-1 uppercase" style={{ color: 'var(--color-primary)' }}>{rule.moduleType} • {rule.conditionType}</p>

                                    <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                            {rule.frequency === 'WEEKLY'
                                                ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rule.dayOfWeek ?? 1]} at ${rule.time || '08:00'}`
                                                : rule.frequency === 'MONTHLY'
                                                ? `Monthly day ${rule.dayOfMonth ?? 1} at ${rule.time || '08:00'}`
                                                : `Daily at ${rule.time || '08:00'}`}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80" onClick={() => openEditRule(rule)}>
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80" onClick={() => duplicateRule(rule)}>
                                            <Copy className="w-3.5 h-3.5" /> Duplicate
                                        </button>
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80 text-red-500" onClick={() => { if (confirm('Delete rule?')) deleteRuleMut.mutate(rule.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</h3>
                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateReport}><Plus className="w-3.5 h-3.5" /> New Action</button>
                    </div>

                    {reportsLoading ? (
                        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="grid gap-4">
                            {(reports || []).map((report: any) => (
                                <div
                                    key={report.id}
                                    className={`card p-5 group flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all cursor-grab active:cursor-grabbing ${dragOverReportId === report.id ? 'ring-2 shadow-lg' : ''} ${!report.active ? 'opacity-60 bg-gray-50' : ''}`}
                                    style={dragOverReportId === report.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                    draggable
                                    onDoubleClick={() => openEditReport(report)}
                                    onDragStart={() => setDraggingReportId(report.id)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverReportId(report.id); }}
                                    onDragLeave={() => setDragOverReportId(null)}
                                    onDrop={() => handleReportDrop(report.id)}
                                    onDragEnd={() => { setDraggingReportId(null); setDragOverReportId(null); }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${!report.active ? 'bg-gray-200' : 'bg-purple-50'}`}>
                                            <FileText className={`w-5 h-5 ${!report.active ? 'text-gray-400' : 'text-purple-600'}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    className="font-bold text-sm text-left hover:opacity-80"
                                                    style={{ color: 'var(--color-text)' }}
                                                    onClick={() => openEditReport(report)}
                                                >
                                                    {report.name}
                                                </button>
                                                <button
                                                    className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${report.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}
                                                    onClick={() => toggleReportMut.mutate({ id: report.id, active: !report.active })}
                                                >
                                                    {report.active ? 'ENABLED' : 'DISABLED'}
                                                </button>
                                            </div>
                                            <p className="text-[11px] mt-1 font-medium uppercase" style={{ color: 'var(--color-primary)' }}>
                                                {REPORT_TYPE_LABELS[report.reportType] || report.reportType}
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {normalizeReportFrequency(report.frequency) === 'ONE_TIME'
                                                    ? `One time at ${report.time}`
                                                    : normalizeReportFrequency(report.frequency) === 'WEEKLY'
                                                    ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][report.dayOfWeek ?? 1]} at ${report.time}`
                                                    : normalizeReportFrequency(report.frequency) === 'MONTHLY'
                                                    ? `Monthly on day ${report.dayOfMonth ?? 1} at ${report.time}`
                                                    : normalizeReportFrequency(report.frequency) === 'QUARTERLY'
                                                    ? `Quarterly on day ${report.dayOfMonth ?? 1} at ${report.time}`
                                                    : `Daily at ${report.time}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="text-xs font-bold inline-flex items-center gap-1 hover:opacity-80"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                            onClick={openNotificationSettings}
                                        >
                                            {renderChannelIcons()} {getChannelLabel()}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80" onClick={() => openEditReport(report)}>
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80" onClick={() => duplicateReport(report)}>
                                            <Copy className="w-3.5 h-3.5" /> Duplicate
                                        </button>
                                        <button className="inline-flex items-center gap-1 text-xs hover:opacity-80 text-red-500" onClick={() => { if (confirm('Delete schedule?')) deleteReportMut.mutate(report.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showRuleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRuleModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingRule ? 'Edit Notification' : 'New Notification'}</h3>
                            <button onClick={closeRuleModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingRule) updateRuleMut.mutate({ id: editingRule.id, body: ruleForm });
                            else createRuleMut.mutate(ruleForm);
                        }} className="space-y-4">
                            <div>
                                <label className="label">Name <span className="text-red-500">*</span></label>
                                <input className="input" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required />
                            </div>

                            {/* Module + Condition */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Module <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.moduleType} onChange={(e) => {
                                        const mod = e.target.value;
                                        const firstCond = CONDITIONS_BY_MODULE[mod]?.[0]?.value ?? 'OVERDUE';
                                        setRuleForm({ ...ruleForm, moduleType: mod, conditionType: firstCond, conditionValue: '' });
                                    }}>
                                        <option value="GOAL">Goals</option>
                                        <option value="TASK">Tasks</option>
                                        <option value="HOUSEWORK">Housework</option>
                                        <option value="EXPENSE">Expenses</option>
                                        <option value="CALENDAR">Calendar</option>
                                        <option value="ASSETS">Appliances & Devices</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Condition <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.conditionType} onChange={(e) => setRuleForm({ ...ruleForm, conditionType: e.target.value, conditionValue: '' })}>
                                        {(CONDITIONS_BY_MODULE[ruleForm.moduleType] || []).map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Threshold value for conditions that need it */}
                                {CONDITIONS_BY_MODULE[ruleForm.moduleType]?.find(c => c.value === ruleForm.conditionType)?.hasThreshold && (
                                    <div className="col-span-2">
                                        <label className="label">
                                            {ruleForm.conditionType === 'PROGRESS_BELOW' ? 'Threshold (%)' : 'Threshold Value'}
                                            <span className="text-red-500"> *</span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input"
                                            min={0}
                                            max={ruleForm.conditionType === 'PROGRESS_BELOW' ? 100 : undefined}
                                            value={ruleForm.conditionValue}
                                            onChange={(e) => setRuleForm({ ...ruleForm, conditionValue: e.target.value })}
                                            placeholder={ruleForm.conditionType === 'PROGRESS_BELOW' ? 'e.g. 50' : 'e.g. 1000000'}
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Frequency <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.frequency} onChange={(e) => setRuleForm({ ...ruleForm, frequency: e.target.value })}>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Time</label>
                                    <input type="time" className="input" value={ruleForm.time} onChange={(e) => setRuleForm({ ...ruleForm, time: e.target.value })} />
                                </div>
                                {ruleForm.frequency === 'WEEKLY' && (
                                    <div className="col-span-2">
                                        <label className="label">Day of Week</label>
                                        <select className="input" value={ruleForm.dayOfWeek} onChange={(e) => setRuleForm({ ...ruleForm, dayOfWeek: Number(e.target.value) })}>
                                            <option value={1}>Monday</option>
                                            <option value={2}>Tuesday</option>
                                            <option value={3}>Wednesday</option>
                                            <option value={4}>Thursday</option>
                                            <option value={5}>Friday</option>
                                            <option value={6}>Saturday</option>
                                            <option value={0}>Sunday</option>
                                        </select>
                                    </div>
                                )}
                                {ruleForm.frequency === 'MONTHLY' && (
                                    <div className="col-span-2">
                                        <label className="label">Day of Month</label>
                                        <select className="input" value={ruleForm.dayOfMonth} onChange={(e) => setRuleForm({ ...ruleForm, dayOfMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ruleForm.active}
                                    onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })}
                                    className="rounded"
                                />
                                <span style={{ color: 'var(--color-text)' }}>Enable notification</span>
                            </label>

                            <button type="submit" className="btn-primary w-full" disabled={createRuleMut.isPending || updateRuleMut.isPending}>
                                {editingRule ? 'Save Notification' : 'Create Notification'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeReportModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingReport ? 'Edit Action' : 'Schedule Action'}</h3>
                            <button onClick={closeReportModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingReport) updateReportMut.mutate({ id: editingReport.id, body: reportForm });
                            else createReportMut.mutate(reportForm);
                        }} className="space-y-4">
                            <div>
                                <label className="label">Name <span className="text-red-500">*</span></label>
                                <input
                                    className="input"
                                    value={reportForm.name}
                                    onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                                    placeholder="e.g. Morning Today Tasks"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="label">Action Type</label>
                                    <select
                                        className="input"
                                        value={reportForm.reportType}
                                        onChange={(e) => {
                                            const reportType = e.target.value;
                                            setReportForm({
                                                ...reportForm,
                                                reportType,
                                                frequency: getDefaultFrequency(reportType),
                                                sections: getDefaultSections(reportType),
                                            });
                                        }}
                                    >
                                        <option value="WEEKLY_SUMMARY">Weekly Summary</option>
                                        <option value="NEXT_WEEK_TASKS">Next Week Tasks</option>
                                        <option value="TODAY_TASKS">Today Tasks</option>
                                        <option value="TOMORROW_TASKS">Tomorrow Tasks</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Frequency</label>
                                    <select className="input" value={reportForm.frequency} onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}>
                                        {reportForm.reportType === 'TODAY_TASKS' || reportForm.reportType === 'TOMORROW_TASKS' ? (
                                            <>
                                                <option value="ONE_TIME">One Time</option>
                                                <option value="DAILY">Daily</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="ONE_TIME">One Time</option>
                                                <option value="DAILY">Daily</option>
                                                <option value="WEEKLY">Weekly</option>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="QUARTERLY">Quarterly</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Time</label>
                                    <input type="time" className="input" value={reportForm.time} onChange={(e) => setReportForm({ ...reportForm, time: e.target.value })} />
                                </div>
                                {reportForm.frequency === 'WEEKLY' && (
                                    <div className="col-span-2">
                                        <label className="label">Day of Week</label>
                                        <select className="input" value={reportForm.dayOfWeek} onChange={(e) => setReportForm({ ...reportForm, dayOfWeek: Number(e.target.value) })}>
                                            <option value={1}>Monday</option>
                                            <option value={2}>Tuesday</option>
                                            <option value={3}>Wednesday</option>
                                            <option value={4}>Thursday</option>
                                            <option value={5}>Friday</option>
                                            <option value={6}>Saturday</option>
                                            <option value={0}>Sunday</option>
                                        </select>
                                    </div>
                                )}
                                {(reportForm.frequency === 'MONTHLY' || reportForm.frequency === 'QUARTERLY') && (
                                    <div className="col-span-2">
                                        <label className="label">Day of Month</label>
                                        <select className="input" value={reportForm.dayOfMonth} onChange={(e) => setReportForm({ ...reportForm, dayOfMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <label className="label">Include Sections <span className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>(checked items are included)</span></label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {(SECTIONS_BY_TYPE[reportForm.reportType] || []).map(({ key, label }) => {
                                            const checked = reportForm.sections.includes(key);
                                            return (
                                                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            let current = [...reportForm.sections];
                                                            if (e.target.checked) {
                                                                current = [...new Set([...current, key])];
                                                            } else {
                                                                current = current.filter(k => k !== key);
                                                            }
                                                            setReportForm({ ...reportForm, sections: current });
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span style={{ color: 'var(--color-text)' }}>{label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Delivered via your notification channel in Settings.
                            </p>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={reportForm.active}
                                    onChange={(e) => setReportForm({ ...reportForm, active: e.target.checked })}
                                    className="rounded"
                                />
                                <span style={{ color: 'var(--color-text)' }}>Enable schedule</span>
                            </label>
                            <button type="submit" className="btn-primary w-full" disabled={createReportMut.isPending || updateReportMut.isPending}>
                                {editingReport ? 'Save Action' : 'Schedule Action'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
