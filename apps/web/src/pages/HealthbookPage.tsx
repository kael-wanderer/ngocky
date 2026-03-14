import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    ArrowLeft, Plus, Edit2, Trash2, HeartPulse, User, Phone, Shield,
    Paperclip, Upload, X, FileText, Image, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthFile {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    label?: string;
    createdAt: string;
}

interface HealthPerson {
    id: string;
    name: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    bloodType?: string;
    allergies?: string;
    chronicConditions?: string;
    currentMedications?: string;
    organDonor: boolean;
    emergencyContact1Name?: string;
    emergencyContact1Phone?: string;
    emergencyContact1Relationship?: string;
    emergencyContact2Name?: string;
    emergencyContact2Phone?: string;
    emergencyContact2Relationship?: string;
    insuranceProvider?: string;
    insuranceCardNumber?: string;
    policyNumber?: string;
    insuranceExpiry?: string;
    coverageType?: string;
    notes?: string;
    isShared: boolean;
    userId: string;
    user: { id: string; name: string };
    files?: HealthFile[];
    _count?: { files: number; logs: number };
}

interface HealthLog {
    id: string;
    personId: string;
    date: string;
    type: string;
    location?: string;
    doctor?: string;
    symptoms?: string;
    description?: string;
    cost?: number;
    prescription?: string;
    nextCheckupDate?: string;
    userId: string;
    files: HealthFile[];
    createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const LOG_TYPES: { value: string; label: string }[] = [
    { value: 'REGULAR_CHECKUP', label: 'Regular Checkup' },
    { value: 'DOCTOR_VISIT', label: 'Doctor Visit' },
    { value: 'EMERGENCY', label: 'Emergency' },
    { value: 'VACCINATION', label: 'Vaccination' },
    { value: 'PRESCRIPTION', label: 'Prescription' },
    { value: 'LAB_RESULT', label: 'Lab Result' },
    { value: 'OTHER', label: 'Other' },
];

const EMPTY_PERSON = {
    name: '', dateOfBirth: '', gender: '', nationality: '', bloodType: '',
    allergies: '', chronicConditions: '', currentMedications: '', organDonor: false,
    emergencyContact1Name: '', emergencyContact1Phone: '', emergencyContact1Relationship: '',
    emergencyContact2Name: '', emergencyContact2Phone: '', emergencyContact2Relationship: '',
    insuranceProvider: '', insuranceCardNumber: '', policyNumber: '', insuranceExpiry: '',
    coverageType: '', notes: '', isShared: false,
};

const EMPTY_LOG = {
    date: new Date().toISOString().slice(0, 10),
    type: 'DOCTOR_VISIT', location: '', doctor: '', symptoms: '',
    description: '', cost: '', prescription: '', nextCheckupDate: '',
};

function parseAmount(val: string): number | undefined {
    if (!val) return undefined;
    const s = val.trim().toLowerCase();
    if (s.endsWith('m')) return parseFloat(s) * 1_000_000;
    if (s.endsWith('k')) return parseFloat(s) * 1_000;
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
}

function logTypeLabel(type: string) {
    return LOG_TYPES.find((t) => t.value === type)?.label ?? type;
}

function logTypeBadgeClass(type: string) {
    const map: Record<string, string> = {
        EMERGENCY: 'bg-red-100 text-red-700',
        REGULAR_CHECKUP: 'bg-green-100 text-green-700',
        DOCTOR_VISIT: 'bg-blue-100 text-blue-700',
        VACCINATION: 'bg-purple-100 text-purple-700',
        PRESCRIPTION: 'bg-yellow-100 text-yellow-700',
        LAB_RESULT: 'bg-cyan-100 text-cyan-700',
        OTHER: 'bg-gray-100 text-gray-700',
    };
    return map[type] ?? 'bg-gray-100 text-gray-700';
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | boolean | null }) {
    if (!value && value !== false) return null;
    return (
        <div className="flex gap-2 text-sm">
            <span className="text-gray-500 min-w-[140px]">{label}:</span>
            <span style={{ color: 'var(--color-text)' }}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</span>
        </div>
    );
}

function FileItem({ file, kind, onDelete }: { file: HealthFile; kind: 'person' | 'log'; onDelete: () => void }) {
    const { user } = useAuthStore();
    const isImage = file.mimeType.startsWith('image/');
    const [viewing, setViewing] = useState(false);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    const handleView = async () => {
        try {
            const res = await api.get(`/healthbook/files/${kind}/${file.id}`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            if (!isImage) {
                window.open(url, '_blank');
            } else {
                setBlobUrl(url);
                setViewing(true);
            }
        } catch { /* ignore */ }
    };

    return (
        <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {isImage ? <Image className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }} title={file.originalName}>{file.originalName}</span>
                <span className="text-gray-400 text-xs">{formatFileSize(file.size)}</span>
                <button onClick={handleView} className="p-1 rounded hover:bg-gray-100" title="View"><Eye className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" title="Delete"><X className="w-3.5 h-3.5 text-red-400" /></button>
            </div>
            {viewing && blobUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={() => { setViewing(false); URL.revokeObjectURL(blobUrl); setBlobUrl(null); }}>
                    <div onMouseDown={(e) => e.stopPropagation()} className="max-w-3xl max-h-[90vh] p-2 rounded-xl bg-white">
                        <img src={blobUrl} alt={file.originalName} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                    </div>
                </div>
            )}
        </>
    );
}

function FileUploader({ url, onUploaded }: { url: string; onUploaded: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError('Max file size is 2 MB'); return; }
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) { setError('Only JPEG, PNG, WebP, PDF allowed'); return; }
        setError('');
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            onUploaded();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFile} />
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading…' : 'Upload file'}
            </button>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
}

// ─── Person Modal ─────────────────────────────────────────────────────────────

function PersonModal({ editing, onClose, onSaved }: { editing?: HealthPerson; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState(editing ? {
        name: editing.name, dateOfBirth: editing.dateOfBirth?.slice(0, 10) ?? '',
        gender: editing.gender ?? '', nationality: editing.nationality ?? '',
        bloodType: editing.bloodType ?? '', allergies: editing.allergies ?? '',
        chronicConditions: editing.chronicConditions ?? '', currentMedications: editing.currentMedications ?? '',
        organDonor: editing.organDonor,
        emergencyContact1Name: editing.emergencyContact1Name ?? '', emergencyContact1Phone: editing.emergencyContact1Phone ?? '',
        emergencyContact1Relationship: editing.emergencyContact1Relationship ?? '',
        emergencyContact2Name: editing.emergencyContact2Name ?? '', emergencyContact2Phone: editing.emergencyContact2Phone ?? '',
        emergencyContact2Relationship: editing.emergencyContact2Relationship ?? '',
        insuranceProvider: editing.insuranceProvider ?? '', insuranceCardNumber: editing.insuranceCardNumber ?? '',
        policyNumber: editing.policyNumber ?? '', insuranceExpiry: editing.insuranceExpiry?.slice(0, 10) ?? '',
        coverageType: editing.coverageType ?? '', notes: editing.notes ?? '', isShared: editing.isShared,
    } : { ...EMPTY_PERSON });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { setError('Name is required'); return; }
        setSaving(true); setError('');
        try {
            const body: any = {
                ...form,
                dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : null,
                insuranceExpiry: form.insuranceExpiry ? new Date(form.insuranceExpiry).toISOString() : null,
            };
            if (editing) { await api.patch(`/healthbook/${editing.id}`, body); }
            else { await api.post('/healthbook', body); }
            onSaved();
        } catch (e: any) { setError(e.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500";
    const labelCls = "block text-xs font-medium mb-1";

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
            <div onMouseDown={(e) => e.stopPropagation()} className="rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
                style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <HeartPulse className="w-5 h-5 text-pink-500" />
                    <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>{editing ? 'Edit Person' : 'Add Person'}</h2>
                    <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-5">
                    {/* Identity */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Identity</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Full Name *</label>
                                <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.name} onChange={(e) => set('name', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Date of Birth</label>
                                <input type="date" className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Gender</label>
                                <select className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                                    <option value="">—</option>
                                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Blood Type</label>
                                <select className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
                                    <option value="">—</option>
                                    {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Nationality</label>
                                <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                                <input type="checkbox" id="organDonor" checked={form.organDonor} onChange={(e) => set('organDonor', e.target.checked)} className="rounded" />
                                <label htmlFor="organDonor" className="text-sm" style={{ color: 'var(--color-text)' }}>Organ Donor</label>
                            </div>
                        </div>
                    </div>

                    {/* Medical */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Medical Info</p>
                        <div className="space-y-3">
                            {[
                                { key: 'allergies', label: 'Allergies' },
                                { key: 'chronicConditions', label: 'Chronic Conditions' },
                                { key: 'currentMedications', label: 'Current Medications' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className={labelCls} style={{ color: 'var(--color-text)' }}>{label}</label>
                                    <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' }}
                                        value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Emergency Contacts */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Emergency Contacts</p>
                        {[1, 2].map((n) => (
                            <div key={n} className="grid grid-cols-3 gap-2 mb-2">
                                <div>
                                    <label className={labelCls} style={{ color: 'var(--color-text)' }}>Contact {n} Name</label>
                                    <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        value={(form as any)[`emergencyContact${n}Name`]} onChange={(e) => set(`emergencyContact${n}Name`, e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls} style={{ color: 'var(--color-text)' }}>Phone</label>
                                    <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        value={(form as any)[`emergencyContact${n}Phone`]} onChange={(e) => set(`emergencyContact${n}Phone`, e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls} style={{ color: 'var(--color-text)' }}>Relationship</label>
                                    <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        value={(form as any)[`emergencyContact${n}Relationship`]} onChange={(e) => set(`emergencyContact${n}Relationship`, e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Insurance */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Insurance</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'insuranceProvider', label: 'Provider' },
                                { key: 'insuranceCardNumber', label: 'Card Number' },
                                { key: 'policyNumber', label: 'Policy Number' },
                                { key: 'coverageType', label: 'Coverage Type' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className={labelCls} style={{ color: 'var(--color-text)' }}>{label}</label>
                                    <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                                </div>
                            ))}
                            <div>
                                <label className={labelCls} style={{ color: 'var(--color-text)' }}>Expiry Date</label>
                                <input type="date" className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    value={form.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Notes + Share */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Notes</label>
                            <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' }}
                                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isShared" checked={form.isShared} onChange={(e) => set('isShared', e.target.checked)} className="rounded" />
                            <label htmlFor="isShared" className="text-sm" style={{ color: 'var(--color-text)' }}>Share with all family members</label>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        {saving ? 'Saving…' : editing ? 'Update' : 'Add Person'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Log Modal ────────────────────────────────────────────────────────────────

function LogModal({ personId, editing, onClose, onSaved }: { personId: string; editing?: HealthLog; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState(editing ? {
        date: editing.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        type: editing.type, location: editing.location ?? '', doctor: editing.doctor ?? '',
        symptoms: editing.symptoms ?? '', description: editing.description ?? '',
        cost: editing.cost != null ? String(editing.cost) : '', prescription: editing.prescription ?? '',
        nextCheckupDate: editing.nextCheckupDate?.slice(0, 10) ?? '',
    } : { ...EMPTY_LOG });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.date) { setError('Date is required'); return; }
        setSaving(true); setError('');
        try {
            const costVal = parseAmount(form.cost);
            const body: any = {
                ...form,
                date: new Date(form.date).toISOString(),
                cost: costVal,
                nextCheckupDate: form.nextCheckupDate ? new Date(form.nextCheckupDate).toISOString() : null,
            };
            if (editing) { await api.patch(`/healthbook/${personId}/logs/${editing.id}`, body); }
            else { await api.post(`/healthbook/${personId}/logs`, body); }
            onSaved();
        } catch (e: any) { setError(e.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500";
    const labelCls = "block text-xs font-medium mb-1";

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
            <div onMouseDown={(e) => e.stopPropagation()} className="rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto mx-4"
                style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>{editing ? 'Edit Log' : 'Add Medical Log'}</h2>
                    <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Date *</label>
                            <input type="date" className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.date} onChange={(e) => set('date', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Type</label>
                            <select className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.type} onChange={(e) => set('type', e.target.value)}>
                                {LOG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Hospital / Clinic</label>
                            <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.location} onChange={(e) => set('location', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Doctor</label>
                            <input className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.doctor} onChange={(e) => set('doctor', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={{ color: 'var(--color-text)' }}>Symptoms</label>
                        <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' }}
                            value={form.symptoms} onChange={(e) => set('symptoms', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelCls} style={{ color: 'var(--color-text)' }}>Description / Diagnosis</label>
                        <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' }}
                            value={form.description} onChange={(e) => set('description', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelCls} style={{ color: 'var(--color-text)' }}>Prescription / Notes</label>
                        <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' }}
                            value={form.prescription} onChange={(e) => set('prescription', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Cost (VND)</label>
                            <input placeholder="e.g. 500k, 1.2M" className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.cost} onChange={(e) => set('cost', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--color-text)' }}>Next Checkup Date</label>
                            <input type="date" className={inputCls} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                                value={form.nextCheckupDate} onChange={(e) => set('nextCheckupDate', e.target.value)} />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        {saving ? 'Saving…' : editing ? 'Update' : 'Add Log'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HealthbookPage() {
    const { personId } = useParams<{ personId?: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const qc = useQueryClient();

    const [personModal, setPersonModal] = useState<{ open: boolean; editing?: HealthPerson }>({ open: false });
    const [logModal, setLogModal] = useState<{ open: boolean; editing?: HealthLog }>({ open: false });
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; kind: 'person' | 'log' } | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

    // ── Queries ──────────────────────────────────────────────────────────────

    const personsQuery = useQuery({
        queryKey: ['healthbook-persons'],
        queryFn: async () => (await api.get('/healthbook')).data.data as HealthPerson[],
        enabled: !personId,
    });

    const personQuery = useQuery({
        queryKey: ['healthbook-person', personId],
        queryFn: async () => (await api.get(`/healthbook/${personId}`)).data.data as HealthPerson,
        enabled: !!personId,
    });

    const logsQuery = useQuery({
        queryKey: ['healthbook-logs', personId],
        queryFn: async () => (await api.get(`/healthbook/${personId}/logs`)).data.data as HealthLog[],
        enabled: !!personId,
    });

    // ── Mutations ────────────────────────────────────────────────────────────

    const deletePerson = useMutation({
        mutationFn: (id: string) => api.delete(`/healthbook/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['healthbook-persons'] }); navigate('/healthbook'); },
    });

    const deleteLog = useMutation({
        mutationFn: ({ id }: { id: string }) => api.delete(`/healthbook/${personId}/logs/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['healthbook-logs', personId] }),
    });

    const deletePersonFile = useMutation({
        mutationFn: (fileId: string) => api.delete(`/healthbook/files/person/${fileId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['healthbook-person', personId] }),
    });

    const deleteLogFile = useMutation({
        mutationFn: (fileId: string) => api.delete(`/healthbook/files/log/${fileId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['healthbook-logs', personId] }),
    });

    const toggleLog = (id: string) => {
        setExpandedLogs((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const isOwner = (record: { userId: string }) => record.userId === user?.id;

    // ── List View ────────────────────────────────────────────────────────────

    if (!personId) {
        const persons = personsQuery.data ?? [];
        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Healthbook</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Family health records & emergency info</p>
                    </div>
                    <button onClick={() => setPersonModal({ open: true })}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Plus className="w-4 h-4" /> Add Person
                    </button>
                </div>

                {personsQuery.isLoading && <p className="text-sm text-gray-500">Loading…</p>}

                {!personsQuery.isLoading && persons.length === 0 && (
                    <div className="text-center py-16">
                        <HeartPulse className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 text-sm">No health records yet. Add a family member to start.</p>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {persons.map((p) => (
                        <div key={p.id} className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md cursor-pointer"
                            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                            onClick={() => navigate(`/healthbook/${p.id}`)}>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)' }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        {p.dateOfBirth ? format(new Date(p.dateOfBirth), 'MMM d, yyyy') : '—'}
                                        {p.bloodType && <span className="ml-2 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">{p.bloodType}</span>}
                                    </p>
                                </div>
                            </div>
                            {(p.emergencyContact1Name || p.emergencyContact1Phone) && (
                                <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    <Phone className="w-3 h-3" />
                                    <span className="truncate">{p.emergencyContact1Name}{p.emergencyContact1Phone ? ` · ${p.emergencyContact1Phone}` : ''}</span>
                                </div>
                            )}
                            {p.insuranceProvider && (
                                <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    <Shield className="w-3 h-3" />
                                    <span className="truncate">{p.insuranceProvider}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 mt-1 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p._count?.logs ?? 0} log{(p._count?.logs ?? 0) !== 1 ? 's' : ''}</span>
                                {p.isShared && !isOwner(p) && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">Owner: {p.user.name}</span>}
                                {p.isShared && isOwner(p) && <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Shared</span>}
                                <div className="ml-auto flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    {isOwner(p) && (
                                        <>
                                            <button onClick={() => setPersonModal({ open: true, editing: p })} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Edit">
                                                <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm({ id: p.id, kind: 'person' })} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {personModal.open && (
                    <PersonModal editing={personModal.editing} onClose={() => setPersonModal({ open: false })}
                        onSaved={() => { setPersonModal({ open: false }); qc.invalidateQueries({ queryKey: ['healthbook-persons'] }); }} />
                )}

                {deleteConfirm?.kind === 'person' && (
                    <ConfirmModal message="Delete this person and all their health records?"
                        onConfirm={() => { deletePerson.mutate(deleteConfirm.id); setDeleteConfirm(null); }}
                        onCancel={() => setDeleteConfirm(null)} />
                )}
            </div>
        );
    }

    // ── Detail View ──────────────────────────────────────────────────────────

    const person = personQuery.data;
    const logs = logsQuery.data ?? [];

    if (personQuery.isLoading) return <p className="text-sm text-gray-500 p-4">Loading…</p>;
    if (!person) return <p className="text-sm text-red-500 p-4">Person not found.</p>;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/healthbook')} className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-secondary)' }}>
                    <ArrowLeft className="w-4 h-4" /> Healthbook
                </button>
                <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{person.name}</span>
                {isOwner(person) && (
                    <button onClick={() => setPersonModal({ open: true, editing: person })}
                        className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit Person
                    </button>
                )}
            </div>

            {/* Person Info Card */}
            <div className="rounded-2xl border mb-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                        style={{ background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)' }}>
                        {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{person.name}</p>
                        <div className="flex items-center gap-2">
                            {person.bloodType && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">{person.bloodType}</span>}
                            {person.gender && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{person.gender}</span>}
                            {person.organDonor && <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Organ Donor</span>}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                    <InfoRow label="Date of Birth" value={person.dateOfBirth ? format(new Date(person.dateOfBirth), 'MMM d, yyyy') : undefined} />
                    <InfoRow label="Nationality" value={person.nationality} />
                    <InfoRow label="Allergies" value={person.allergies} />
                    <InfoRow label="Chronic Conditions" value={person.chronicConditions} />
                    <InfoRow label="Current Medications" value={person.currentMedications} />
                    {person.emergencyContact1Name && <InfoRow label="Emergency Contact 1" value={`${person.emergencyContact1Name}${person.emergencyContact1Relationship ? ` (${person.emergencyContact1Relationship})` : ''} · ${person.emergencyContact1Phone ?? ''}`} />}
                    {person.emergencyContact2Name && <InfoRow label="Emergency Contact 2" value={`${person.emergencyContact2Name}${person.emergencyContact2Relationship ? ` (${person.emergencyContact2Relationship})` : ''} · ${person.emergencyContact2Phone ?? ''}`} />}
                    <InfoRow label="Insurance" value={person.insuranceProvider} />
                    <InfoRow label="Card Number" value={person.insuranceCardNumber} />
                    <InfoRow label="Policy Number" value={person.policyNumber} />
                    <InfoRow label="Coverage" value={person.coverageType} />
                    <InfoRow label="Insurance Expiry" value={person.insuranceExpiry ? format(new Date(person.insuranceExpiry), 'MMM d, yyyy') : undefined} />
                    {person.notes && (
                        <div className="col-span-2 mt-1">
                            <InfoRow label="Notes" value={person.notes} />
                        </div>
                    )}
                </div>

                {/* Person files */}
                <div className="px-6 pb-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Documents</span>
                        {isOwner(person) && (
                            <div className="ml-auto">
                                <FileUploader url={`/healthbook/${person.id}/files`} onUploaded={() => qc.invalidateQueries({ queryKey: ['healthbook-person', personId] })} />
                            </div>
                        )}
                    </div>
                    {(person.files ?? []).length === 0 && <p className="text-xs text-gray-400">No documents attached.</p>}
                    <div className="space-y-1.5 mt-2">
                        {(person.files ?? []).map((f) => (
                            <FileItem key={f.id} file={f} kind="person" onDelete={() => deletePersonFile.mutate(f.id)} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Medical History */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Medical History</h2>
                <button onClick={() => setLogModal({ open: true })}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white font-medium transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Plus className="w-4 h-4" /> Add Log
                </button>
            </div>

            {logsQuery.isLoading && <p className="text-sm text-gray-500">Loading…</p>}

            {!logsQuery.isLoading && logs.length === 0 && (
                <div className="text-center py-10 rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm text-gray-400">No medical history yet.</p>
                </div>
            )}

            <div className="space-y-3">
                {logs.map((log) => {
                    const expanded = expandedLogs.has(log.id);
                    return (
                        <div key={log.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            {/* Log header - always visible */}
                            <div className="flex items-start gap-3 px-5 py-4 cursor-pointer" onClick={() => toggleLog(log.id)}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${logTypeBadgeClass(log.type)}`}>{logTypeLabel(log.type)}</span>
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{format(new Date(log.date), 'MMM d, yyyy')}</span>
                                        {log.location && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>· {log.location}</span>}
                                        {log.doctor && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>· Dr. {log.doctor}</span>}
                                    </div>
                                    {log.symptoms && !expanded && <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>{log.symptoms}</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {log.cost != null && (
                                        <span className="text-xs font-medium text-red-500">{log.cost.toLocaleString('vi-VN')} ₫</span>
                                    )}
                                    {isOwner(log) && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); setLogModal({ open: true, editing: log }); }} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                                                <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: log.id, kind: 'log' }); }} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </>
                                    )}
                                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                            </div>

                            {/* Expanded details */}
                            {expanded && (
                                <div className="border-t px-5 py-4 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                                    {log.symptoms && <InfoRow label="Symptoms" value={log.symptoms} />}
                                    {log.description && <InfoRow label="Diagnosis / Notes" value={log.description} />}
                                    {log.prescription && <InfoRow label="Prescription" value={log.prescription} />}
                                    {log.nextCheckupDate && <InfoRow label="Next Checkup" value={format(new Date(log.nextCheckupDate), 'MMM d, yyyy')} />}

                                    {/* Log files */}
                                    <div className="pt-2 border-t mt-2" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attachments</span>
                                            {isOwner(log) && (
                                                <div className="ml-auto">
                                                    <FileUploader url={`/healthbook/${personId}/logs/${log.id}/files`} onUploaded={() => qc.invalidateQueries({ queryKey: ['healthbook-logs', personId] })} />
                                                </div>
                                            )}
                                        </div>
                                        {log.files.length === 0 && <p className="text-xs text-gray-400">No attachments.</p>}
                                        <div className="space-y-1.5 mt-2">
                                            {log.files.map((f) => (
                                                <FileItem key={f.id} file={f} kind="log" onDelete={() => deleteLogFile.mutate(f.id)} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {personModal.open && (
                <PersonModal editing={personModal.editing} onClose={() => setPersonModal({ open: false })}
                    onSaved={() => { setPersonModal({ open: false }); qc.invalidateQueries({ queryKey: ['healthbook-person', personId] }); }} />
            )}

            {logModal.open && (
                <LogModal personId={personId} editing={logModal.editing} onClose={() => setLogModal({ open: false })}
                    onSaved={() => { setLogModal({ open: false }); qc.invalidateQueries({ queryKey: ['healthbook-logs', personId] }); }} />
            )}

            {deleteConfirm?.kind === 'log' && (
                <ConfirmModal message="Delete this medical log?"
                    onConfirm={() => { deleteLog.mutate({ id: deleteConfirm.id }); setDeleteConfirm(null); }}
                    onCancel={() => setDeleteConfirm(null)} />
            )}
        </div>
    );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
            <div onMouseDown={(e) => e.stopPropagation()} className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
                </div>
            </div>
        </div>
    );
}
