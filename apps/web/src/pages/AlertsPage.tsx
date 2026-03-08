import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Bell, BellRing, Copy, FileText, Info, Mail, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';

const emptyRuleForm = () => ({
    name: '',
    moduleType: 'GOAL',
    frequency: 'DAILY',
    conditionType: 'OVERDUE',
    conditionValue: '',
    notificationChannel: 'EMAIL',
    active: true,
});

const emptyReportForm = () => ({
    reportType: 'SUMMARY',
    frequency: 'WEEKLY',
    dayOfWeek: 1,
    time: '08:00',
    notificationChannel: 'EMAIL',
    recipients: [] as string[],
    active: true,
});

export default function AlertsPage() {
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState<'RULES' | 'REPORTS'>('RULES');
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [editingReport, setEditingReport] = useState<any>(null);
    const [ruleForm, setRuleForm] = useState(emptyRuleForm());
    const [reportForm, setReportForm] = useState(emptyReportForm());
    const [recipientInput, setRecipientInput] = useState('');

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

    const createReportMut = useMutation({
        mutationFn: (body: any) => api.post('/scheduled-reports', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-reports'] }); closeReportModal(); },
    });

    const updateReportMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/scheduled-reports/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-reports'] }); closeReportModal(); },
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
        setRuleForm({
            name: rule.name || '',
            moduleType: rule.moduleType || 'GOAL',
            frequency: rule.frequency || 'DAILY',
            conditionType: rule.conditionType || 'OVERDUE',
            conditionValue: rule.conditionValue || '',
            notificationChannel: rule.notificationChannel || 'EMAIL',
            active: rule.active ?? true,
        });
        setShowRuleModal(true);
    }

    function duplicateRule(rule: any) {
        createRuleMut.mutate({
            name: `${rule.name} (Copy)`,
            moduleType: rule.moduleType,
            frequency: rule.frequency,
            conditionType: rule.conditionType,
            conditionValue: rule.conditionValue || '',
            notificationChannel: rule.notificationChannel,
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
        setRecipientInput('');
        setShowReportModal(true);
    }

    function openEditReport(report: any) {
        setEditingReport(report);
        setReportForm({
            reportType: report.reportType || 'SUMMARY',
            frequency: report.frequency || 'WEEKLY',
            dayOfWeek: report.dayOfWeek ?? 1,
            time: report.time || '08:00',
            notificationChannel: report.notificationChannel || 'EMAIL',
            recipients: report.recipients || [],
            active: report.active ?? true,
        });
        setRecipientInput('');
        setShowReportModal(true);
    }

    function duplicateReport(report: any) {
        createReportMut.mutate({
            reportType: report.reportType,
            frequency: report.frequency,
            dayOfWeek: report.dayOfWeek,
            time: report.time,
            notificationChannel: report.notificationChannel,
            recipients: report.recipients || [],
            active: report.active,
        });
    }

    function closeReportModal() {
        setShowReportModal(false);
        setEditingReport(null);
        setReportForm(emptyReportForm());
        setRecipientInput('');
    }

    function addRecipient() {
        if (!recipientInput || reportForm.recipients.includes(recipientInput)) return;
        setReportForm({ ...reportForm, recipients: [...reportForm.recipients, recipientInput] });
        setRecipientInput('');
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <BellRing className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Scheduled Action</h2>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                    <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'RULES' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('RULES')} style={activeTab === 'RULES' ? { color: 'var(--color-primary)' } : {}}>Rules</button>
                    <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('REPORTS')} style={activeTab === 'REPORTS' ? { color: 'var(--color-primary)' } : {}}>Scheduled Reports</button>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-xs text-blue-800 leading-relaxed">
                    <strong>Automation Hub:</strong> Scheduled action rules and scheduled reports can be edited or duplicated directly from this page.
                </div>
            </div>

            {activeTab === 'RULES' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Active Rules</h3>
                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateRule}><Plus className="w-3.5 h-3.5" /> New Rule</button>
                    </div>

                    {rulesLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {(rules || []).map((rule: any) => (
                                <div key={rule.id} className={`card p-5 group transition-all ${!rule.active ? 'opacity-60 bg-gray-50' : ''}`}>
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
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{rule.frequency}</span>
                                        <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: rule.notificationChannel === 'EMAIL' ? '#4f46e5' : '#10b981' }}>
                                            <Settings2 className="w-3 h-3" /> {rule.notificationChannel}
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
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Schedules</h3>
                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateReport}><Plus className="w-3.5 h-3.5" /> New Schedule</button>
                    </div>

                    {reportsLoading ? (
                        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="grid gap-4">
                            {(reports || []).map((report: any) => (
                                <div key={report.id} className="card p-5 group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-50 rounded-xl">
                                            <FileText className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{report.reportType} Report</h4>
                                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Every {report.frequency.toLowerCase()} at {report.time}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:block text-right">
                                            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Recipients</span>
                                            <div className="flex flex-wrap justify-end gap-1">
                                                {report.recipients.map((recipient: string) => (
                                                    <span key={recipient} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{recipient}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold inline-flex items-center gap-1 text-primary" style={{ color: 'var(--color-primary)' }}>
                                                <Mail className="w-3.5 h-3.5" /> {report.notificationChannel}
                                            </span>
                                        </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeRuleModal}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}</h3>
                            <button onClick={closeRuleModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingRule) updateRuleMut.mutate({ id: editingRule.id, body: ruleForm });
                            else createRuleMut.mutate(ruleForm);
                        }} className="space-y-4">
                            <div>
                                <label className="label">Rule Name <span className="text-red-500">*</span></label>
                                <input className="input" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Module <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.moduleType} onChange={(e) => setRuleForm({ ...ruleForm, moduleType: e.target.value })}>
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
                                    <select className="input" value={ruleForm.conditionType} onChange={(e) => setRuleForm({ ...ruleForm, conditionType: e.target.value })}>
                                        <option value="OVERDUE">Overdue</option>
                                        <option value="DUE_TODAY">Due Today</option>
                                        <option value="THRESHOLD_EXCEEDED">Threshold Exceeded</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Frequency <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.frequency} onChange={(e) => setRuleForm({ ...ruleForm, frequency: e.target.value })}>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Notification Channel <span className="text-red-500">*</span></label>
                                    <select className="input" value={ruleForm.notificationChannel} onChange={(e) => setRuleForm({ ...ruleForm, notificationChannel: e.target.value })}>
                                        <option value="EMAIL">Email</option>
                                        <option value="TELEGRAM">Telegram</option>
                                        <option value="BOTH">Both</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createRuleMut.isPending || updateRuleMut.isPending}>
                                {editingRule ? 'Save Rule' : 'Create Alert Rule'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeReportModal}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingReport ? 'Edit Schedule' : 'Schedule Report'}</h3>
                            <button onClick={closeReportModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingReport) updateReportMut.mutate({ id: editingReport.id, body: reportForm });
                            else createReportMut.mutate(reportForm);
                        }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="label">Report Type</label>
                                    <select className="input" value={reportForm.reportType} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })}>
                                        <option value="SUMMARY">Weekly Summary</option>
                                        <option value="EXPENSE_LIST">Expense Detailed List</option>
                                        <option value="GOAL_PROGRESS">Goal Progress Report</option>
                                        <option value="LEARNING_SUMMARY">Learning Summary</option>
                                        <option value="IDEA_SUMMARY">Idea Summary</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Frequency</label>
                                    <select className="input" value={reportForm.frequency} onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Time</label>
                                    <input type="time" className="input" value={reportForm.time} onChange={(e) => setReportForm({ ...reportForm, time: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Recipients</label>
                                    <div className="flex gap-2">
                                        <input className="input flex-1" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())} placeholder="Email address" />
                                        <button type="button" className="btn-ghost" onClick={addRecipient}>Add</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {reportForm.recipients.map((recipient) => (
                                            <span key={recipient} className="text-[10px] px-2 py-1 bg-gray-100 rounded flex items-center gap-1">
                                                {recipient} <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setReportForm({ ...reportForm, recipients: reportForm.recipients.filter((item) => item !== recipient) })} />
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createReportMut.isPending || updateReportMut.isPending}>
                                {editingReport ? 'Save Schedule' : 'Schedule Report'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
