import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '../utils/useLocalStorage';
import api from '../api/client';
import { Bell, BellRing, ChevronDown, ChevronUp, Copy, FileText, Info, LayoutGrid, List, Mail, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FEATURE_GROUPS } from '../config/features';

type SortDir = 'asc' | 'desc';
function SortHeader({ label, col, sort, onSort, className }: { label: string; col: string; sort: { col: string; dir: SortDir }; onSort: (col: string) => void; className?: string }) {
    const active = sort.col === col;
    return (
        <button className={`flex items-center gap-0.5 hover:opacity-80 transition-opacity ${className ?? ''}`} onClick={() => onSort(col)}>
            {label}
            {active ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
        </button>
    );
}
function applySortStr(items: any[], sort: { col: string; dir: SortDir }, getter: (item: any, col: string) => string) {
    return [...items].sort((a, b) => {
        const av = getter(a, sort.col).toLowerCase();
        const bv = getter(b, sort.col).toLowerCase();
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
}

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

// Section key for each feature flag key
const FEATURE_KEY_TO_SECTION: Record<string, string> = {
    featureTasks: 'TASKS',
    featureProjects: 'PROJECT',
    featureExpenses: 'EXPENSES',
    featureGoals: 'GOALS',
    featureIdeas: 'IDEAS',
    featureCalendar: 'CALENDAR',
    featureCaKeo: 'CAKEO',
    featureHousework: 'HOUSEWORK',
    featureAssets: 'ASSETS',
    featureHealthbook: 'HEALTHBOOK',
    featureKeyboard: 'KEYBOARD',
    featureFunds: 'FUNDS',
    featureLearning: 'LEARNING',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
    WEEKLY_SUMMARY: 'Weekly Summary',
    SUMMARY: 'Weekly Summary',
    THIS_WEEK_TASKS: 'This Week Tasks',
    NEXT_WEEK_TASKS: 'Next Week Tasks',
    TODAY_TASKS: 'Today Tasks',
    TOMORROW_TASKS: 'Tomorrow Tasks',
};

function getDefaultSections(_reportType?: string) {
    return ['TASKS', 'CALENDAR', 'CAKEO', 'HOUSEWORK'];
}

function getDefaultFrequency(reportType: string) {
    if (reportType === 'TODAY_TASKS' || reportType === 'TOMORROW_TASKS') return 'ONE_TIME';
    if (reportType === 'THIS_WEEK_TASKS') return 'WEEKLY';
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
    const showTabSwitcher = !forcedTab;
    const [rulesListView, setRulesListView] = useLocalStorage('ngocky:alerts:rulesListView', false);
    const [reportsListView, setReportsListView] = useLocalStorage('ngocky:alerts:reportsListView', false);
    const [rulesSort, setRulesSort] = useLocalStorage<{ col: string; dir: SortDir }>('ngocky:alerts:rulesSort', { col: 'name', dir: 'asc' });
    const [reportsSort, setReportsSort] = useLocalStorage<{ col: string; dir: SortDir }>('ngocky:alerts:reportsSort', { col: 'name', dir: 'asc' });

    function toggleRulesSort(col: string) {
        setRulesSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    }
    function toggleReportsSort(col: string) {
        setReportsSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    }

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
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeTab === 'RULES' ? 'Notifications' : 'Schedule Report'}</h2>
                </div>
                {showTabSwitcher && (
                    <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'RULES' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('RULES')} style={activeTab === 'RULES' ? { color: 'var(--color-primary)' } : {}}>Notification Settings</button>
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('REPORTS')} style={activeTab === 'REPORTS' ? { color: 'var(--color-primary)' } : {}}>Schedule Report</button>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-xs text-blue-800 leading-relaxed">
                    <strong>Schedule Report:</strong> Reports are delivered via your notification channel configured in Settings. Alert rules and scheduled reports can be edited or duplicated directly from this page.
                </div>
            </div>

            {activeTab === 'RULES' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Notification Rules</h3>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                                <button className={`p-1 rounded-md transition-all ${!rulesListView ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setRulesListView(false)} title="Grid view"><LayoutGrid className="w-3.5 h-3.5" /></button>
                                <button className={`p-1 rounded-md transition-all ${rulesListView ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setRulesListView(true)} title="List view"><List className="w-3.5 h-3.5" /></button>
                            </div>
                            <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateRule}><Plus className="w-3.5 h-3.5" /> New Notification</button>
                        </div>
                    </div>

                    {rulesLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-gray-50" />)}</div>
                    ) : rulesListView ? (
                        <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                <span className="w-3.5 shrink-0" />
                                <SortHeader label="Name" col="name" sort={rulesSort} onSort={toggleRulesSort} className="flex-1" />
                                <SortHeader label="Module" col="module" sort={rulesSort} onSort={toggleRulesSort} className="w-20 shrink-0" />
                                <SortHeader label="Status" col="status" sort={rulesSort} onSort={toggleRulesSort} className="w-16 shrink-0" />
                                <span className="w-36 shrink-0">Schedule</span>
                                <span className="w-20 shrink-0">Actions</span>
                            </div>
                            {applySortStr(rules || [], rulesSort, (r, col) => col === 'name' ? r.name : col === 'module' ? r.moduleType : col === 'status' ? String(r.active) : '').map((rule: any) => (
                                <div key={rule.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!rule.active ? 'opacity-60' : ''}`} onClick={() => openEditRule(rule)}>
                                    <Bell className="w-3.5 h-3.5 shrink-0" style={{ color: rule.active ? 'var(--color-primary)' : undefined }} />
                                    <span className="font-medium text-sm flex-1 line-clamp-1" style={{ color: 'var(--color-text)' }}>{rule.name}</span>
                                    <span className="text-[10px] font-medium uppercase w-20 shrink-0" style={{ color: 'var(--color-primary)' }}>{rule.moduleType}</span>
                                    <div className="w-16 shrink-0">
                                        <button className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${rule.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`} onClick={() => toggleRuleMut.mutate({ id: rule.id, active: !rule.active })}>
                                            {rule.active ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <span className="text-[11px] w-36 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                                        {rule.frequency === 'WEEKLY'
                                            ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rule.dayOfWeek ?? 1]} at ${rule.time || '08:00'}`
                                            : rule.frequency === 'MONTHLY'
                                            ? `Monthly day ${rule.dayOfMonth ?? 1} at ${rule.time || '08:00'}`
                                            : `Daily at ${rule.time || '08:00'}`}
                                    </span>
                                    <div className="flex items-center gap-1 w-20 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button className="p-1 rounded text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit" onClick={() => openEditRule(rule)}><Pencil className="w-3.5 h-3.5" /></button>
                                        <button className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Duplicate" onClick={() => duplicateRule(rule)}><Copy className="w-3.5 h-3.5" /></button>
                                        <button className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete" onClick={() => { if (confirm('Delete rule?')) deleteRuleMut.mutate(rule.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {(rules || []).map((rule: any) => (
                                <div
                                    key={rule.id}
                                    className={`card p-5 group transition-all ${!rule.active ? 'opacity-60 bg-gray-50' : ''}`}
                                    onClick={() => openEditRule(rule)}
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
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                                <button className={`p-1 rounded-md transition-all ${!reportsListView ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setReportsListView(false)} title="Grid view"><LayoutGrid className="w-3.5 h-3.5" /></button>
                                <button className={`p-1 rounded-md transition-all ${reportsListView ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setReportsListView(true)} title="List view"><List className="w-3.5 h-3.5" /></button>
                            </div>
                            <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateReport}><Plus className="w-3.5 h-3.5" /> New Action</button>
                        </div>
                    </div>

                    {reportsLoading ? (
                        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
                    ) : reportsListView ? (
                        <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                <span className="w-3.5 shrink-0" />
                                <SortHeader label="Name" col="name" sort={reportsSort} onSort={toggleReportsSort} className="flex-1" />
                                <SortHeader label="Type" col="type" sort={reportsSort} onSort={toggleReportsSort} className="w-28 shrink-0" />
                                <SortHeader label="Status" col="status" sort={reportsSort} onSort={toggleReportsSort} className="w-16 shrink-0" />
                                <span className="w-40 shrink-0">Schedule</span>
                                <span className="w-20 shrink-0">Actions</span>
                            </div>
                            {applySortStr(reports || [], reportsSort, (r, col) => col === 'name' ? r.name : col === 'type' ? (REPORT_TYPE_LABELS[r.reportType] || r.reportType) : col === 'status' ? String(r.active) : '').map((report: any) => (
                                <div key={report.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!report.active ? 'opacity-60' : ''}`} onClick={() => openEditReport(report)}>
                                    <FileText className={`w-3.5 h-3.5 shrink-0 ${!report.active ? 'text-gray-400' : 'text-purple-600'}`} />
                                    <span className="font-medium text-sm flex-1 line-clamp-1" style={{ color: 'var(--color-text)' }}>{report.name}</span>
                                    <span className="text-[10px] font-medium uppercase w-28 shrink-0" style={{ color: 'var(--color-primary)' }}>{REPORT_TYPE_LABELS[report.reportType] || report.reportType}</span>
                                    <div className="w-16 shrink-0">
                                        <button className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${report.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`} onClick={() => toggleReportMut.mutate({ id: report.id, active: !report.active })}>
                                            {report.active ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <span className="text-[11px] w-40 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                                        {normalizeReportFrequency(report.frequency) === 'ONE_TIME'
                                            ? `One time at ${report.time}`
                                            : normalizeReportFrequency(report.frequency) === 'WEEKLY'
                                            ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][report.dayOfWeek ?? 1]} at ${report.time}`
                                            : normalizeReportFrequency(report.frequency) === 'MONTHLY'
                                            ? `Monthly on day ${report.dayOfMonth ?? 1} at ${report.time}`
                                            : normalizeReportFrequency(report.frequency) === 'QUARTERLY'
                                            ? `Quarterly on day ${report.dayOfMonth ?? 1} at ${report.time}`
                                            : normalizeReportFrequency(report.frequency) === 'WEEKDAY'
                                            ? `Weekday at ${report.time}`
                                            : normalizeReportFrequency(report.frequency) === 'WEEKEND'
                                            ? `Weekend at ${report.time}`
                                            : `Daily at ${report.time}`}
                                    </span>
                                    <div className="flex items-center gap-1 w-20 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button className="p-1 rounded text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit" onClick={() => openEditReport(report)}><Pencil className="w-3.5 h-3.5" /></button>
                                        <button className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Duplicate" onClick={() => duplicateReport(report)}><Copy className="w-3.5 h-3.5" /></button>
                                        <button className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete" onClick={() => { if (confirm('Delete schedule?')) deleteReportMut.mutate(report.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {(reports || []).map((report: any) => (
                                <div
                                    key={report.id}
                                    className={`card p-5 group flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${!report.active ? 'opacity-60 bg-gray-50' : ''}`}
                                    onClick={() => openEditReport(report)}
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
                                                    : normalizeReportFrequency(report.frequency) === 'WEEKDAY'
                                                    ? `Weekday at ${report.time}`
                                                    : normalizeReportFrequency(report.frequency) === 'WEEKEND'
                                                    ? `Weekend at ${report.time}`
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
                    <div className="card modal-panel p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
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
                                        <option value="ASSETS">Assets</option>
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

                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingRule && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (confirm('Delete rule?')) {
                                                    deleteRuleMut.mutate(editingRule.id);
                                                    closeRuleModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeRuleModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createRuleMut.isPending || updateRuleMut.isPending}>
                                        {editingRule ? 'Save' : 'Create Notification'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeReportModal(); }}>
                    <div className="card modal-panel p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingReport ? 'Edit Report' : 'Schedule Report'}</h3>
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
                                    <label className="label">Report Type</label>
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
                                        <option value="THIS_WEEK_TASKS">This Week Tasks</option>
                                        <option value="NEXT_WEEK_TASKS">Next Week Tasks</option>
                                        <option value="TODAY_TASKS">Today Tasks</option>
                                        <option value="TOMORROW_TASKS">Tomorrow Tasks</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Frequency</label>
                                    <select className="input" value={reportForm.frequency} onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}>
                                        {(reportForm.reportType === 'TODAY_TASKS' || reportForm.reportType === 'TOMORROW_TASKS') ? (
                                            <>
                                                <option value="ONE_TIME">One Time</option>
                                                <option value="DAILY">Daily</option>
                                                <option value="WEEKDAY">Weekday</option>
                                                <option value="WEEKEND">Weekend</option>
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
                                    <label className="label">Include Module <span className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>(checked items are included)</span></label>
                                    <div className="space-y-3 mt-1">
                                        {FEATURE_GROUPS.map((group) => {
                                            const enabledItems = group.items.filter((item) => {
                                                const flag = item.key as string;
                                                return profile?.[flag] !== false;
                                            });
                                            if (enabledItems.length === 0) return null;
                                            return (
                                                <div key={group.id}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>{group.label}</p>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {enabledItems.map((item) => {
                                                            const key = FEATURE_KEY_TO_SECTION[item.key] ?? item.key.toUpperCase();
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
                                                                    <span style={{ color: 'var(--color-text)' }}>{item.label}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Delivered via your notification channel in Settings.
                            </p>
                            <div className="rounded-lg border p-3 flex items-start gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                                <input
                                    id="report-active"
                                    type="checkbox"
                                    checked={reportForm.active}
                                    onChange={(e) => setReportForm({ ...reportForm, active: e.target.checked })}
                                    className="rounded mt-0.5"
                                />
                                <label htmlFor="report-active" className="cursor-pointer flex-1">
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Enable</span>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>When enabled, this report will be sent automatically on the configured schedule.</p>
                                </label>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingReport && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (confirm('Delete schedule?')) {
                                                    deleteReportMut.mutate(editingReport.id);
                                                    closeReportModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeReportModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createReportMut.isPending || updateReportMut.isPending}>
                                        {editingReport ? 'Save' : 'Schedule Report'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
