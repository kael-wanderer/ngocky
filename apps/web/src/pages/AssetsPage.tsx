import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '../utils/useLocalStorage';
import api from '../api/client';
import { ArrowDown, ArrowUp, Bell, Calendar, Copy, Filter, LayoutGrid, List, Microwave, Pencil, Pin, Plus, Trash2, Wrench, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import MultiSelectFilter from '../components/MultiSelectFilter';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';
import { parseCompactAmountInput } from '../utils/amount';
import { getFundsDateRange } from '../config/fundsFilters';

const emptyAssetForm = () => ({
    name: '',
    type: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyMonths: '',
    isShared: false,
    note: '',
});

const ASSET_TYPES = ['Vehicle', 'Appliances', 'Devices'] as const;

const emptyRecordForm = () => ({
    serviceDate: format(new Date(), 'yyyy-MM-dd'),
    serviceType: '',
    description: '',
    cost: '',
    vendor: '',
    nextRecommendedDate: '',
    kilometers: '',
    ...emptyNotification,
    pinToDashboard: false,
    addToCalendar: false,
    addExpense: false,
});

const formatVND = (amount: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;

type Asset = {
    id: string;
    name: string;
    type?: string | null;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    purchaseDate?: string | null;
    warrantyMonths?: number | null;
    isShared?: boolean;
    note?: string | null;
};

type MaintenanceRecord = {
    id: string;
    serviceDate: string;
    serviceType?: string | null;
    description?: string | null;
    cost?: number | null;
    vendor?: string | null;
    nextRecommendedDate?: string | null;
    kilometers?: number | null;
    pinToDashboard?: boolean;
    linkedEventId?: string | null;
    linkedExpenseId?: string | null;
    notificationEnabled?: boolean;
    reminderOffsetDays?: number | null;
    reminderOffsetValue?: number | null;
    reminderOffsetUnit?: string | null;
    notificationDate?: string | null;
    notificationTime?: string | null;
};

function formatRecordNotificationBadges(record: MaintenanceRecord): string[] {
    if (!record.notificationEnabled) return [];
    const time = record.notificationTime || '';
    if (record.reminderOffsetUnit === 'ON_DATE' && record.notificationDate) {
        const d = new Date(record.notificationDate);
        return [format(d, 'MMM dd, yyyy'), ...(time ? [time] : [])];
    }
    if (record.reminderOffsetUnit === 'HOURS') {
        const label = `${record.reminderOffsetValue ?? ''} hour${record.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    if (record.reminderOffsetUnit === 'DAYS') {
        const label = `${record.reminderOffsetValue ?? ''} day${record.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    // fallback: legacy reminderOffsetDays
    if (record.reminderOffsetDays != null) {
        return [`${record.reminderOffsetDays}d before`];
    }
    return [];
}

type RecordSortKey = 'time' | 'cost' | 'serviceType' | 'kilometers' | 'vendor' | 'description' | 'nextRecommendedDate' | 'linkedEventId';
type RecordDateFilter = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'LAST_QUARTER' | 'THIS_YEAR' | 'LAST_YEAR';
type RecordNextFilter = 'ALL' | 'NOT_EMPTY' | 'EMPTY';
type RecordPriceFilter = 'ALL' | 'LT_2M' | 'BETWEEN_2M_5M' | 'BETWEEN_5M_10M' | 'GT_10M';
type RecordFilterDropdownKey = 'date' | 'next' | 'price' | null;

const RECORD_DATE_FILTER_OPTIONS: Array<{ value: RecordDateFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'THIS_QUARTER', label: 'This Quarter' },
    { value: 'LAST_QUARTER', label: 'Last Quarter' },
    { value: 'THIS_YEAR', label: 'This Year' },
    { value: 'LAST_YEAR', label: 'Last Year' },
];

const RECORD_NEXT_FILTER_OPTIONS: Array<{ value: RecordNextFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'NOT_EMPTY', label: 'Not Empty' },
    { value: 'EMPTY', label: 'Empty' },
];

const RECORD_PRICE_FILTER_OPTIONS: Array<{ value: RecordPriceFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'LT_2M', label: '< 2M' },
    { value: 'BETWEEN_2M_5M', label: '2M to 5M' },
    { value: 'BETWEEN_5M_10M', label: '5M to 10M' },
    { value: 'GT_10M', label: 'Over 10M' },
];

function AssetCard({
    asset,
    userId,
    listMode,
    onOpen,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    asset: Asset;
    userId?: string;
    listMode: 'grid' | 'list';
    onOpen: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const sharedOwnerName = getSharedOwnerName(asset, userId);
    const canManage = !sharedOwnerName;

    if (listMode === 'list') {
        return (
            <div
                className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => canManage ? onEdit() : onOpen()}
            >
                <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block" style={{ color: 'var(--color-text)' }}>{asset.name}</span>
                    <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                        {asset.type || [asset.brand, asset.model].filter(Boolean).join(' ') || '—'}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {asset.isShared && <span className="text-[9px] px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                    {canManage && (
                        <>
                            <button className="p-1 rounded hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                                <Pencil className="w-3 h-3" style={{ color: 'var(--color-text-secondary)' }} />
                            </button>
                            <button className="p-1 rounded hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                                <Copy className="w-3 h-3" style={{ color: 'var(--color-text-secondary)' }} />
                            </button>
                            <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="card p-4 cursor-pointer transition-all hover:shadow-md" onClick={() => canManage ? onEdit() : onOpen()}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{asset.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {asset.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                        {sharedOwnerName && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</span>}
                    </div>
                    <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {[asset.brand, asset.model].filter(Boolean).join(' ') || asset.type || 'No brand/model'}
                    </p>
                </div>
                {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AssetsPage() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { assetId } = useParams();
    const { user } = useAuthStore();

    const [showAssetModal, setShowAssetModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
    const [recordOptionsOpen, setRecordOptionsOpen] = useState(false);
    const [assetForm, setAssetForm] = useState(emptyAssetForm());
    const [recordForm, setRecordForm] = useState(emptyRecordForm());
    const [recordSortBy, setRecordSortBy] = useLocalStorage<RecordSortKey>('ngocky:assets:recordSortBy', 'time');
    const [recordSortOrder, setRecordSortOrder] = useLocalStorage<'asc' | 'desc'>('ngocky:assets:recordSortOrder', 'desc');
    const [assetListView, setAssetListView] = useLocalStorage<'grid' | 'list'>('ngocky:assets:listView', 'grid');
    const [recordViewMode, setRecordViewMode] = useLocalStorage<'grid' | 'list'>('ngocky:assets:recordViewMode', 'grid');
    const [recordSearch, setRecordSearch] = useState('');
    const [recordDateFilter, setRecordDateFilter] = useLocalStorage<RecordDateFilter>('ngocky:assets:recordDateFilter', 'ALL');
    const [recordNextFilter, setRecordNextFilter] = useLocalStorage<RecordNextFilter>('ngocky:assets:recordNextFilter', 'ALL');
    const [recordPriceFilter, setRecordPriceFilter] = useLocalStorage<RecordPriceFilter>('ngocky:assets:recordPriceFilter', 'ALL');
    const [recordOpenFilter, setRecordOpenFilter] = useState<RecordFilterDropdownKey>(null);

    const { data: assets, isLoading: assetsLoading } = useQuery({
        queryKey: ['assets'],
        queryFn: async () => (await api.get('/assets')).data.data,
    });

    const selectedAsset = useMemo(
        () => ((assets || []) as Asset[]).find((item) => item.id === assetId) ?? null,
        [assets, assetId],
    );

    const { data: records, isLoading: recordsLoading } = useQuery({
        queryKey: ['maintenance', selectedAsset?.id, recordSortBy, recordSortOrder],
        queryFn: async () => {
            const apiSortBy = recordSortBy === 'cost' ? 'cost' : 'time';
            return (await api.get(`/assets/${selectedAsset!.id}/maintenance?sortBy=${apiSortBy}&sortOrder=${recordSortOrder}`)).data.data;
        },
        enabled: !!selectedAsset,
    });

    const sortedRecords = useMemo(() => {
        const items = [...(records || [])] as MaintenanceRecord[];

        const getSortValue = (record: MaintenanceRecord, key: RecordSortKey) => {
            switch (key) {
                case 'time':
                    return new Date(record.serviceDate).getTime();
                case 'cost':
                    return record.cost ?? -1;
                case 'serviceType':
                    return record.serviceType || '';
                case 'kilometers':
                    return record.kilometers ?? -1;
                case 'vendor':
                    return record.vendor || '';
                case 'description':
                    return record.description || '';
                case 'nextRecommendedDate':
                    return record.nextRecommendedDate ? new Date(record.nextRecommendedDate).getTime() : -1;
                case 'linkedEventId':
                    return record.linkedEventId ? 1 : 0;
                default:
                    return '';
            }
        };

        return items.sort((left, right) => {
            const leftValue = getSortValue(left, recordSortBy);
            const rightValue = getSortValue(right, recordSortBy);
            const result = typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
            return recordSortOrder === 'asc' ? result : -result;
        });
    }, [records, recordSortBy, recordSortOrder]);

    const filteredRecords = useMemo(() => {
        const search = recordSearch.trim().toLowerCase();
        const dateRange = recordDateFilter === 'ALL' ? null : getFundsDateRange(recordDateFilter);

        return sortedRecords.filter((record) => {
            if (search) {
                const haystack = [
                    record.serviceType || '',
                    record.vendor || '',
                    record.description || '',
                ].join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }

            if (dateRange) {
                const serviceTime = new Date(record.serviceDate).getTime();
                if (serviceTime < dateRange.start.getTime() || serviceTime > dateRange.end.getTime()) return false;
            }

            if (recordNextFilter === 'NOT_EMPTY' && !record.nextRecommendedDate) return false;
            if (recordNextFilter === 'EMPTY' && record.nextRecommendedDate) return false;

            const price = record.cost ?? null;
            switch (recordPriceFilter) {
                case 'LT_2M':
                    if (!(price != null && price < 2_000_000)) return false;
                    break;
                case 'BETWEEN_2M_5M':
                    if (!(price != null && price >= 2_000_000 && price < 5_000_000)) return false;
                    break;
                case 'BETWEEN_5M_10M':
                    if (!(price != null && price >= 5_000_000 && price < 10_000_000)) return false;
                    break;
                case 'GT_10M':
                    if (!(price != null && price >= 10_000_000)) return false;
                    break;
                default:
                    break;
            }

            return true;
        });
    }, [sortedRecords, recordSearch, recordDateFilter, recordNextFilter, recordPriceFilter]);

    const createAssetMut = useMutation({
        mutationFn: (body: any) => api.post('/assets', body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            closeAssetModal();
            navigate(`/assets/${data.data.id}`);
        },
    });

    const updateAssetMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/assets/${id}`, body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            closeAssetModal();
            navigate(`/assets/${data.data.id}`, { replace: true });
        },
    });

    const deleteAssetMut = useMutation({
        mutationFn: (id: string) => api.delete(`/assets/${id}`),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            if (selectedAsset?.id === id) navigate('/assets', { replace: true });
        },
    });

    const createRecordMut = useMutation({
        mutationFn: ({ assetId: currentAssetId, body }: { assetId: string; body: any }) => api.post(`/assets/${currentAssetId}/maintenance`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] });
            closeRecordModal();
        },
    });

    const updateRecordMut = useMutation({
        mutationFn: ({ assetId: currentAssetId, recordId, body }: { assetId: string; recordId: string; body: any }) => api.patch(`/assets/${currentAssetId}/maintenance/${recordId}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] });
            closeRecordModal();
        },
    });

    const deleteRecordMut = useMutation({
        mutationFn: ({ assetId: currentAssetId, recordId }: { assetId: string; recordId: string }) => api.delete(`/assets/${currentAssetId}/maintenance/${recordId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] }),
    });

    function openCreateAsset() {
        setEditingAsset(null);
        setAssetForm(emptyAssetForm());
        setShowAssetModal(true);
    }

    function openEditAsset(asset: Asset) {
        setEditingAsset(asset);
        setAssetForm({
            name: asset.name || '',
            type: asset.type || '',
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate ? format(new Date(asset.purchaseDate), 'yyyy-MM-dd') : '',
            warrantyMonths: asset.warrantyMonths ? String(asset.warrantyMonths) : '',
            isShared: !!asset.isShared,
            note: asset.note || '',
        });
        setShowAssetModal(true);
    }

    function closeAssetModal() {
        setShowAssetModal(false);
        setEditingAsset(null);
        setAssetForm(emptyAssetForm());
    }

    function duplicateAsset(asset: Asset) {
        createAssetMut.mutate({
            name: `${asset.name} (Copy)`,
            type: asset.type || '',
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate || null,
            warrantyMonths: asset.warrantyMonths || undefined,
            isShared: !!asset.isShared,
            note: asset.note || '',
        });
    }

    function handleAssetSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const payload = {
            ...assetForm,
            purchaseDate: assetForm.purchaseDate ? new Date(`${assetForm.purchaseDate}T00:00:00`).toISOString() : null,
            warrantyMonths: assetForm.warrantyMonths ? Number(assetForm.warrantyMonths) : undefined,
        };

        if (editingAsset) {
            updateAssetMut.mutate({ id: editingAsset.id, body: payload });
            return;
        }

        createAssetMut.mutate(payload);
    }

    function openCreateRecord() {
        setEditingRecord(null);
        setRecordForm(emptyRecordForm());
        setShowRecordModal(true);
    }

    function openEditRecord(record: MaintenanceRecord) {
        setEditingRecord(record);
        setRecordForm({
            serviceDate: format(new Date(record.serviceDate), 'yyyy-MM-dd'),
            serviceType: record.serviceType || '',
            description: record.description || '',
            cost: record.cost ? String(Math.round(record.cost)) : '',
            vendor: record.vendor || '',
            nextRecommendedDate: record.nextRecommendedDate ? format(new Date(record.nextRecommendedDate), 'yyyy-MM-dd') : '',
            kilometers: record.kilometers != null ? String(record.kilometers) : '',
            ...loadNotificationState(record as any),
            pinToDashboard: !!record.pinToDashboard,
            addToCalendar: !!record.linkedEventId,
            addExpense: !!record.linkedExpenseId,
        });
        setShowRecordModal(true);
    }

    function closeRecordModal() {
        setShowRecordModal(false);
        setEditingRecord(null);
        setRecordForm(emptyRecordForm());
        setRecordOptionsOpen(false);
    }

    function duplicateRecord(record: MaintenanceRecord) {
        if (!selectedAsset) return;
        createRecordMut.mutate({
            assetId: selectedAsset.id,
            body: {
                serviceDate: new Date(record.serviceDate).toISOString(),
                serviceType: record.serviceType || '',
                description: record.description || '',
                cost: typeof record.cost === 'number' ? record.cost : undefined,
                vendor: record.vendor || '',
                nextRecommendedDate: record.nextRecommendedDate || null,
                kilometers: record.kilometers ?? undefined,
                ...buildNotificationPayload(record as any),
                pinToDashboard: !!record.pinToDashboard,
            },
        });
    }

    function handleRecordSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedAsset) return;

        const parsedCost = recordForm.cost.trim() ? parseCompactAmountInput(recordForm.cost) : undefined;
        if (parsedCost !== undefined && Number.isNaN(parsedCost)) {
            window.alert('Cost must be a valid number.');
            return;
        }

        const km = (recordForm as any).kilometers?.trim?.() ? Number((recordForm as any).kilometers) : undefined;
        const body: any = {
            serviceDate: new Date(`${recordForm.serviceDate}T00:00:00`).toISOString(),
            serviceType: recordForm.serviceType,
            description: recordForm.description,
            cost: parsedCost,
            vendor: recordForm.vendor,
            nextRecommendedDate: recordForm.nextRecommendedDate ? new Date(`${recordForm.nextRecommendedDate}T00:00:00`).toISOString() : null,
            kilometers: km,
            ...buildNotificationPayload(recordForm as any),
            pinToDashboard: (recordForm as any).pinToDashboard || false,
        };

        if (editingRecord) {
            updateRecordMut.mutate({ assetId: selectedAsset.id, recordId: editingRecord.id, body });
            return;
        }

        createRecordMut.mutate({ assetId: selectedAsset.id, body });
    }

    function handleDeleteAsset(currentAssetId: string) {
        if (window.confirm('Delete this asset and all maintenance logs?')) deleteAssetMut.mutate(currentAssetId);
    }

    function handleDeleteRecord(recordId: string) {
        if (!selectedAsset) return;
        if (window.confirm('Delete this maintenance log?')) {
            deleteRecordMut.mutate({ assetId: selectedAsset.id, recordId });
        }
    }

    function toggleRecordSort(column: RecordSortKey) {
        if (recordSortBy === column) {
            setRecordSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setRecordSortBy(column);
        setRecordSortOrder(column === 'cost' ? 'desc' : 'asc');
    }

    function renderRecordSortIcon(column: RecordSortKey) {
        if (recordSortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return recordSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Microwave className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Assets</h2>
                </div>
                {!assetId && (
                    <button className="btn-primary" onClick={openCreateAsset}>
                        <Plus className="w-4 h-4" /> New Device
                    </button>
                )}
            </div>

            {!assetId ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>My Assets</h3>
                        <div className="flex items-center gap-1">
                            <button
                                className={`p-1.5 rounded-md transition-colors ${assetListView === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                onClick={() => setAssetListView('grid')}
                                title="Grid view"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                            </button>
                            <button
                                className={`p-1.5 rounded-md transition-colors ${assetListView === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                onClick={() => setAssetListView('list')}
                                title="List view"
                            >
                                <List className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                            </button>
                        </div>
                    </div>

                    {assetsLoading ? (
                        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}</div>
                    ) : assetListView === 'list' ? (
                        <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {(assets || []).map((asset: Asset) => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    userId={user?.id}
                                    listMode="list"
                                    onOpen={() => navigate(`/assets/${asset.id}`)}
                                    onEdit={() => openEditAsset(asset)}
                                    onDuplicate={() => duplicateAsset(asset)}
                                    onDelete={() => handleDeleteAsset(asset.id)}
                                />
                            ))}
                            {assets?.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No appliances or devices yet</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {(assets || []).map((asset: Asset) => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    userId={user?.id}
                                    listMode="grid"
                                    onOpen={() => navigate(`/assets/${asset.id}`)}
                                    onEdit={() => openEditAsset(asset)}
                                    onDuplicate={() => duplicateAsset(asset)}
                                    onDelete={() => handleDeleteAsset(asset.id)}
                                />
                            ))}
                            {assets?.length === 0 && (
                                <div className="text-center py-8 card border-dashed border-2 md:col-span-2 xl:col-span-3">
                                    <Microwave className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No appliances or devices yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : selectedAsset ? (
                <div className="animate-fade-in space-y-6">
                    {(() => {
                        const sharedOwnerName = getSharedOwnerName(selectedAsset, user?.id);
                        const canManage = !sharedOwnerName;

                        return (
                            <>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => navigate('/assets')}>
                                        Back to Assets
                                    </button>
                                    {canManage && (
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => openEditAsset(selectedAsset)}>
                                                <Pencil className="w-3.5 h-3.5" /> Edit Asset
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="card p-6">
                                    <div className="flex items-start justify-between mb-6 gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedAsset.name}</h3>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {selectedAsset.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                {sharedOwnerName && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                <div className="text-xs">
                                                    <span className="font-semibold block mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>Type</span>
                                                    <span style={{ color: 'var(--color-text)' }}>{selectedAsset.type || '-'}</span>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="font-semibold block mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>Brand/Model</span>
                                                    <span style={{ color: 'var(--color-text)' }}>{selectedAsset.brand || '-'} / {selectedAsset.model || '-'}</span>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="font-semibold block mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>Serial Number</span>
                                                    <span style={{ color: 'var(--color-text)' }}>{selectedAsset.serialNumber || '-'}</span>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="font-semibold block mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>Purchase Date</span>
                                                    <span style={{ color: 'var(--color-text)' }}>{selectedAsset.purchaseDate ? new Date(selectedAsset.purchaseDate).toLocaleDateString() : '-'}</span>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="font-semibold block mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>Warranty</span>
                                                    <span style={{ color: 'var(--color-text)' }}>{selectedAsset.warrantyMonths ? `${selectedAsset.warrantyMonths} months` : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedAsset.note && (
                                        <div className="p-3 rounded-lg bg-gray-50 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            <span className="font-bold block mb-1">NOTES</span>
                                            {selectedAsset.note}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                                            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                                        </div>
                                        {canManage && (
                                            <button className="btn-primary py-1.5 px-3 text-xs shrink-0" onClick={openCreateRecord} type="button">
                                                <Wrench className="w-3.5 h-3.5" /> Add Log
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex flex-wrap items-center gap-3 flex-1">
                                        <div className="min-w-[220px] flex-[1.2]">
                                            <input
                                                value={recordSearch}
                                                onChange={(e) => setRecordSearch(e.target.value)}
                                                placeholder="Search by name..."
                                                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <MultiSelectFilter
                                            className="min-w-[150px] flex-1"
                                            label="Date"
                                            allLabel="All dates"
                                            options={RECORD_DATE_FILTER_OPTIONS}
                                            selected={recordDateFilter === 'ALL' ? [] : [recordDateFilter]}
                                            open={recordOpenFilter === 'date'}
                                            onOpenChange={(open) => setRecordOpenFilter(open ? 'date' : null)}
                                            onChange={(values) => setRecordDateFilter((values[values.length - 1] as RecordDateFilter | undefined) ?? 'ALL')}
                                        />
                                        <MultiSelectFilter
                                            className="min-w-[140px] flex-1"
                                            label="Next"
                                            allLabel="All next"
                                            options={RECORD_NEXT_FILTER_OPTIONS}
                                            selected={recordNextFilter === 'ALL' ? [] : [recordNextFilter]}
                                            open={recordOpenFilter === 'next'}
                                            onOpenChange={(open) => setRecordOpenFilter(open ? 'next' : null)}
                                            onChange={(values) => setRecordNextFilter((values[values.length - 1] as RecordNextFilter | undefined) ?? 'ALL')}
                                        />
                                        <MultiSelectFilter
                                            className="min-w-[160px] flex-1"
                                            label="Price"
                                            allLabel="All prices"
                                            options={RECORD_PRICE_FILTER_OPTIONS}
                                            selected={recordPriceFilter === 'ALL' ? [] : [recordPriceFilter]}
                                            open={recordOpenFilter === 'price'}
                                            onOpenChange={(open) => setRecordOpenFilter(open ? 'price' : null)}
                                            onChange={(values) => setRecordPriceFilter((values[values.length - 1] as RecordPriceFilter | undefined) ?? 'ALL')}
                                        />
                                    </div>
                                    <div className="flex flex-col items-end gap-2 ml-auto shrink-0">
                                        <div className="flex items-center gap-2">
                                            <button
                                                className={`p-1.5 rounded-md transition-colors ${recordViewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                                onClick={() => setRecordViewMode('grid')}
                                                title="Grid view"
                                                type="button"
                                            >
                                                <LayoutGrid className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                            </button>
                                            <button
                                                className={`p-1.5 rounded-md transition-colors ${recordViewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                                onClick={() => setRecordViewMode('list')}
                                                title="List view"
                                                type="button"
                                            >
                                                <List className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                </div>

                                <div className="card p-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                                                <Wrench className="w-4 h-4 text-orange-500" /> Maintenance History
                                            </h4>
                                        </div>

                                        {recordsLoading ? (
                                            <div className="space-y-3 pt-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 w-full animate-pulse bg-gray-50 rounded-lg" />)}</div>
                                        ) : recordViewMode === 'grid' ? (
                                            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                {filteredRecords.map((record: MaintenanceRecord) => (
                                                    <div key={record.id} className="py-4 first:pt-0" onClick={() => canManage && openEditRecord(record)}>
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{record.serviceType || 'Maintenance'}</span>
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                        {new Date(record.serviceDate).toLocaleDateString()}
                                                                    </span>
                                                                    <Bell className={`w-3 h-3 flex-shrink-0 ${record.notificationEnabled ? 'text-red-500' : 'text-gray-300'}`} />
                                                                    {formatRecordNotificationBadges(record).map((badge, i) => (
                                                                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600">{badge}</span>
                                                                    ))}
                                                                </div>
                                                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{record.description}</p>
                                                                {record.vendor && (
                                                                    <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-primary)' }}>Vendor: {record.vendor}</p>
                                                                )}
                                                                {record.kilometers != null && (
                                                                    <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>🛞 {record.kilometers.toLocaleString()} km</p>
                                                                )}
                                                                <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                                                                    <button type="button" className={`p-1 transition-colors ${record.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} onClick={() => updateRecordMut.mutate({ assetId: selectedAsset.id, recordId: record.id, body: { pinToDashboard: !record.pinToDashboard } })} title="Pin">
                                                                        <Pin className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => openEditRecord(record)} title="Edit">
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-blue-500 hover:text-blue-600 transition-colors" onClick={() => duplicateRecord(record)} title="Duplicate">
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-red-500 hover:text-red-600 transition-colors" onClick={() => handleDeleteRecord(record.id)} title="Delete">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                {typeof record.cost === 'number' && record.cost > 0 && (
                                                                    <span className="text-sm font-bold block" style={{ color: 'var(--color-text)' }}>
                                                                        {formatVND(record.cost)}
                                                                    </span>
                                                                )}
                                                                {record.nextRecommendedDate && (
                                                                    <span className="text-[10px] text-orange-600 font-medium mt-1 inline-flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" /> Next: {new Date(record.nextRecommendedDate).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                                {record.linkedEventId && (
                                                                    <span className="text-[10px] font-medium mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">
                                                                        <Calendar className="w-3 h-3" /> Asset Calendar
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {records?.length === 0 && (
                                                    <div className="text-center py-10 opacity-40">
                                                        <p className="text-xs">No maintenance logs recorded.</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="pb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="min-w-0 flex-1 grid grid-cols-[110px_220px_120px_140px_minmax(220px,1fr)] gap-3 items-center">
                                                            <button type="button" className="inline-flex items-center gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('time')}>
                                                                Date
                                                                {renderRecordSortIcon('time')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('serviceType')}>
                                                                Service Type
                                                                {renderRecordSortIcon('serviceType')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('kilometers')}>
                                                                Kilometers
                                                                {renderRecordSortIcon('kilometers')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('vendor')}>
                                                                Vendor
                                                                {renderRecordSortIcon('vendor')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('description')}>
                                                                Description
                                                                {renderRecordSortIcon('description')}
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-[112px_96px_112px_188px] gap-3 items-center shrink-0">
                                                            <button type="button" className="inline-flex items-center justify-start gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('nextRecommendedDate')}>
                                                                Next
                                                                {renderRecordSortIcon('nextRecommendedDate')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center justify-start gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('linkedEventId')}>
                                                                Calendar
                                                                {renderRecordSortIcon('linkedEventId')}
                                                            </button>
                                                            <button type="button" className="inline-flex items-center justify-start gap-1 text-left hover:opacity-80" onClick={() => toggleRecordSort('cost')}>
                                                                Price
                                                                {renderRecordSortIcon('cost')}
                                                            </button>
                                                            <div className="text-left">Actions</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {filteredRecords.map((record: MaintenanceRecord) => (
                                                    <div key={record.id} className="py-3 first:pt-0" onClick={() => canManage && openEditRecord(record)}>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="min-w-0 flex-1 grid grid-cols-[110px_220px_120px_140px_minmax(220px,1fr)] gap-3 items-center">
                                                                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {new Date(record.serviceDate).toLocaleDateString()}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                                                                        {record.serviceType || 'Maintenance'}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                                        <Bell className={`w-3 h-3 flex-shrink-0 ${record.notificationEnabled ? 'text-red-500' : 'text-gray-300'}`} />
                                                                        {formatRecordNotificationBadges(record).map((badge, i) => (
                                                                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600">{badge}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {selectedAsset.type === 'Vehicle' && record.kilometers != null ? `${record.kilometers.toLocaleString()} km` : '—'}
                                                                </div>
                                                                <div className="text-xs truncate" style={{ color: record.vendor ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                                                    {record.vendor || '—'}
                                                                </div>
                                                                <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {record.description || '—'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-[112px_96px_112px_188px] gap-3 items-center shrink-0">
                                                                <div className="text-left">
                                                                    {record.nextRecommendedDate ? (
                                                                        <span className="text-[10px] text-orange-600 font-medium inline-flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" /> {new Date(record.nextRecommendedDate).toLocaleDateString()}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-left">
                                                                    {record.linkedEventId ? (
                                                                        <span className="text-[10px] font-medium text-cyan-700">Asset Calendar</span>
                                                                    ) : (
                                                                        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                                                    )}
                                                                </div>
                                                                {typeof record.cost === 'number' && record.cost > 0 && (
                                                                    <span className="text-sm font-bold text-left" style={{ color: 'var(--color-text)' }}>
                                                                        {formatVND(record.cost)}
                                                                    </span>
                                                                )}
                                                                {!(typeof record.cost === 'number' && record.cost > 0) && (
                                                                    <span className="text-sm text-left" style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                                                )}
                                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                    <button type="button" className={`p-1 transition-colors ${record.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} onClick={() => updateRecordMut.mutate({ assetId: selectedAsset.id, recordId: record.id, body: { pinToDashboard: !record.pinToDashboard } })} title="Pin">
                                                                        <Pin className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => openEditRecord(record)} title="Edit">
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-blue-500 hover:text-blue-600 transition-colors" onClick={() => duplicateRecord(record)} title="Duplicate">
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button type="button" className="p-1 text-red-500 hover:text-red-600 transition-colors" onClick={() => handleDeleteRecord(record.id)} title="Delete">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {records?.length === 0 && (
                                                    <div className="text-center py-10 opacity-40">
                                                        <p className="text-xs">No maintenance logs recorded.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            ) : assetsLoading ? (
                <div className="card p-6 h-32 animate-pulse bg-gray-50" />
            ) : (
                <div className="card p-12 text-center border-dashed border-2">
                    <Microwave className="w-12 h-12 mb-4 opacity-10 mx-auto" />
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>Asset Not Found</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        This asset may have been deleted or the link is invalid.
                    </p>
                    <div className="mt-4">
                        <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => navigate('/assets')}>
                            Back to Assets
                        </button>
                    </div>
                </div>
            )}

            {showAssetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAssetModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingAsset ? 'Edit Appliance / Device' : 'Add New Appliance / Device'}</h3>
                            <button onClick={closeAssetModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAssetSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="label">Name <span className="text-red-500">*</span></label>
                                    <input className="input" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. Family Van, Fridge" required />
                                </div>
                                <div>
                                    <label className="label">Type</label>
                                    <select className="input" value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}>
                                        <option value="">— Select type —</option>
                                        {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Brand</label>
                                    <input className="input" value={assetForm.brand} onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })} placeholder="Ford, LG, etc." />
                                </div>
                                <div>
                                    <label className="label">Model</label>
                                    <input className="input" value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Warranty (months)</label>
                                    <input type="number" min={0} className="input" value={assetForm.warrantyMonths} onChange={(e) => setAssetForm({ ...assetForm, warrantyMonths: e.target.value })} placeholder="12, 36..." />
                                </div>
                                <div>
                                    <label className="label">Serial Number</label>
                                    <input className="input" value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Purchase Date</label>
                                    <input type="date" className="input" value={assetForm.purchaseDate} onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Note</label>
                                    <textarea className="input" rows={2} value={assetForm.note} onChange={(e) => setAssetForm({ ...assetForm, note: e.target.value })} placeholder="Any additional details..." />
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: assetForm.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: assetForm.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setAssetForm({ ...assetForm, isShared: !assetForm.isShared })}>
                                <input type="checkbox" checked={assetForm.isShared} onChange={(e) => setAssetForm({ ...assetForm, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this asset visible to all family members</p></div>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingAsset && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this asset and all maintenance logs?')) {
                                                    deleteAssetMut.mutate(editingAsset.id);
                                                    closeAssetModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeAssetModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createAssetMut.isPending || updateAssetMut.isPending}>
                                        {editingAsset ? 'Save' : 'Create Appliance / Device'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRecordModal && selectedAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRecordModal(); }}>
                    <div className="card p-6 w-full max-w-xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingRecord ? 'Edit Maintenance Log' : 'Add Maintenance Log'}</h3>
                            <button onClick={closeRecordModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRecordSubmit} className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="label mb-0">Service Type <span className="text-red-500">*</span></label>
                                    <button type="button" onClick={() => setRecordForm({ ...(recordForm as any), pinToDashboard: !(recordForm as any).pinToDashboard })}
                                        className={`p-1.5 rounded-lg border transition-colors ${(recordForm as any).pinToDashboard ? 'text-amber-500 border-amber-300 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
                                        title="Pin to dashboard">
                                        <Pin className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <input className="input" value={recordForm.serviceType} onChange={(e) => setRecordForm({ ...recordForm, serviceType: e.target.value })} placeholder="Oil Change, Repair, etc." required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date <span className="text-red-500">*</span></label>
                                    <input type="date" className="input" value={recordForm.serviceDate} onChange={(e) => setRecordForm({ ...recordForm, serviceDate: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Cost</label>
                                    <input className="input" value={recordForm.cost} onChange={(e) => setRecordForm({ ...recordForm, cost: e.target.value })} placeholder="Optional, e.g. 600k or 2M" />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Description <span className="text-red-500">*</span></label>
                                    <textarea className="input" rows={2} value={recordForm.description} onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Vendor</label>
                                    <input className="input" value={recordForm.vendor} onChange={(e) => setRecordForm({ ...recordForm, vendor: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Next Recommended</label>
                                    <input type="date" className="input" value={recordForm.nextRecommendedDate} onChange={(e) => setRecordForm({ ...recordForm, nextRecommendedDate: e.target.value })} />
                                </div>
                                {selectedAsset.type === 'Vehicle' && (
                                    <div className="col-span-2">
                                        <label className="label">Kilometers</label>
                                        <input type="number" min={0} className="input" value={(recordForm as any).kilometers} onChange={(e) => setRecordForm({ ...(recordForm as any), kilometers: e.target.value })} placeholder="e.g. 45000" />
                                    </div>
                                )}
                            </div>
                            {/* Options */}
                            <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                <button type="button" onClick={() => setRecordOptionsOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium"
                                    style={{ color: 'var(--color-text)' }}>
                                    <span>Options</span>
                                    {recordOptionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {recordOptionsOpen && (
                                    <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                                        <div
                                            className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer"
                                            style={{ borderColor: (recordForm as any).addToCalendar ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: (recordForm as any).addToCalendar ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent', opacity: !recordForm.nextRecommendedDate ? 0.5 : 1 }}
                                            onClick={() => recordForm.nextRecommendedDate && setRecordForm({ ...(recordForm as any), addToCalendar: !(recordForm as any).addToCalendar })}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(recordForm as any).addToCalendar || false}
                                                disabled={!recordForm.nextRecommendedDate}
                                                onChange={(e) => setRecordForm({ ...(recordForm as any), addToCalendar: e.target.checked })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-0.5"
                                            />
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Add to Calendar</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    {!recordForm.nextRecommendedDate ? 'Requires a next recommended date' : editingRecord?.linkedEventId ? 'Already linked — uncheck to remove it' : 'Creates a calendar event on the next recommended date'}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer"
                                            style={{ borderColor: (recordForm as any).addExpense ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: (recordForm as any).addExpense ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent', opacity: !recordForm.cost ? 0.5 : 1 }}
                                            onClick={() => recordForm.cost && setRecordForm({ ...(recordForm as any), addExpense: !(recordForm as any).addExpense })}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(recordForm as any).addExpense || false}
                                                disabled={!recordForm.cost}
                                                onChange={(e) => setRecordForm({ ...(recordForm as any), addExpense: e.target.checked })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-0.5"
                                            />
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Add expense</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    {!recordForm.cost ? 'Requires a cost' : editingRecord?.linkedExpenseId ? 'Already linked — uncheck to remove it' : 'Creates an expense entry for this service'}
                                                </p>
                                            </div>
                                        </div>
                                        <NotificationFields form={recordForm as any} setForm={setRecordForm as any} />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingRecord && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (selectedAsset && window.confirm('Delete this maintenance log?')) {
                                                    deleteRecordMut.mutate({ assetId: selectedAsset.id, recordId: editingRecord.id });
                                                    closeRecordModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeRecordModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createRecordMut.isPending || updateRecordMut.isPending}>
                                        {editingRecord ? 'Save' : 'Create Log'}
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
