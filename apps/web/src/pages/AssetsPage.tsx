import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Calendar, Copy, Package, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

const emptyAssetForm = () => ({
    name: '',
    type: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    note: '',
});

const emptyRecordForm = () => ({
    serviceDate: format(new Date(), 'yyyy-MM-dd'),
    serviceType: '',
    description: '',
    cost: '',
    vendor: '',
    nextRecommendedDate: '',
});

const formatVND = (amount: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;

export default function AssetsPage() {
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<any>(null);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [assetForm, setAssetForm] = useState(emptyAssetForm());
    const [recordForm, setRecordForm] = useState(emptyRecordForm());
    const assetIdParam = searchParams.get('assetId');

    const { data: assets, isLoading: assetsLoading } = useQuery({
        queryKey: ['assets'],
        queryFn: async () => (await api.get('/assets')).data.data,
    });

    const { data: records, isLoading: recordsLoading } = useQuery({
        queryKey: ['maintenance', selectedAsset?.id],
        queryFn: async () => (await api.get(`/assets/${selectedAsset.id}/maintenance`)).data.data,
        enabled: !!selectedAsset,
    });

    const createAssetMut = useMutation({
        mutationFn: (body: any) => api.post('/assets', body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            setSelectedAsset(data.data);
            closeAssetModal();
        },
    });

    const updateAssetMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/assets/${id}`, body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            setSelectedAsset(data.data);
            closeAssetModal();
        },
    });

    const deleteAssetMut = useMutation({
        mutationFn: (id: string) => api.delete(`/assets/${id}`),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: ['assets'] });
            if (selectedAsset?.id === id) {
                setSelectedAsset(null);
                setSearchParams({});
            }
        },
    });

    const createRecordMut = useMutation({
        mutationFn: ({ assetId, body }: { assetId: string; body: any }) => api.post(`/assets/${assetId}/maintenance`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] });
            closeRecordModal();
        },
    });

    const updateRecordMut = useMutation({
        mutationFn: ({ assetId, recordId, body }: { assetId: string; recordId: string; body: any }) => api.patch(`/assets/${assetId}/maintenance/${recordId}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] });
            closeRecordModal();
        },
    });

    const deleteRecordMut = useMutation({
        mutationFn: ({ assetId, recordId }: { assetId: string; recordId: string }) => api.delete(`/assets/${assetId}/maintenance/${recordId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] }),
    });

    useEffect(() => {
        if (!assetIdParam || !(assets || []).length) return;
        const asset = (assets || []).find((item: any) => item.id === assetIdParam);
        if (asset) setSelectedAsset(asset);
    }, [assetIdParam, assets]);

    useEffect(() => {
        if (!selectedAsset && assetIdParam) setSearchParams({});
    }, [selectedAsset, assetIdParam, setSearchParams]);

    function openCreateAsset() {
        setEditingAsset(null);
        setAssetForm(emptyAssetForm());
        setShowAssetModal(true);
    }

    function openEditAsset(asset: any) {
        setEditingAsset(asset);
        setAssetForm({
            name: asset.name || '',
            type: asset.type || '',
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate ? format(new Date(asset.purchaseDate), 'yyyy-MM-dd') : '',
            note: asset.note || '',
        });
        setShowAssetModal(true);
    }

    function closeAssetModal() {
        setShowAssetModal(false);
        setEditingAsset(null);
        setAssetForm(emptyAssetForm());
    }

    function duplicateAsset(asset: any) {
        createAssetMut.mutate({
            name: `${asset.name} (Copy)`,
            type: asset.type || '',
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate || null,
            note: asset.note || '',
        });
    }

    function handleAssetSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const payload = {
            ...assetForm,
            purchaseDate: assetForm.purchaseDate ? new Date(`${assetForm.purchaseDate}T00:00:00`).toISOString() : null,
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

    function openEditRecord(record: any) {
        setEditingRecord(record);
        setRecordForm({
            serviceDate: format(new Date(record.serviceDate), 'yyyy-MM-dd'),
            serviceType: record.serviceType || '',
            description: record.description || '',
            cost: record.cost ? String(Math.round(record.cost)) : '',
            vendor: record.vendor || '',
            nextRecommendedDate: record.nextRecommendedDate ? format(new Date(record.nextRecommendedDate), 'yyyy-MM-dd') : '',
        });
        setShowRecordModal(true);
    }

    function closeRecordModal() {
        setShowRecordModal(false);
        setEditingRecord(null);
        setRecordForm(emptyRecordForm());
    }

    function duplicateRecord(record: any) {
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
            },
        });
    }

    function handleRecordSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedAsset) return;

        const parsedCost = recordForm.cost.trim() ? Number(recordForm.cost.replace(/,/g, '')) : undefined;
        if (parsedCost !== undefined && Number.isNaN(parsedCost)) {
            window.alert('Cost must be a valid number.');
            return;
        }

        const body = {
            serviceDate: new Date(`${recordForm.serviceDate}T00:00:00`).toISOString(),
            serviceType: recordForm.serviceType,
            description: recordForm.description,
            cost: parsedCost,
            vendor: recordForm.vendor,
            nextRecommendedDate: recordForm.nextRecommendedDate ? new Date(`${recordForm.nextRecommendedDate}T00:00:00`).toISOString() : null,
        };

        if (editingRecord) {
            updateRecordMut.mutate({ assetId: selectedAsset.id, recordId: editingRecord.id, body });
            return;
        }

        createRecordMut.mutate({ assetId: selectedAsset.id, body });
    }

    function handleDeleteAsset(assetId: string) {
        if (window.confirm('Delete this asset and all maintenance logs?')) deleteAssetMut.mutate(assetId);
    }

    function handleDeleteRecord(recordId: string) {
        if (!selectedAsset) return;
        if (window.confirm('Delete this maintenance log?')) {
            deleteRecordMut.mutate({ assetId: selectedAsset.id, recordId });
        }
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Assets & Maintenance</h2>
                </div>
                <button className="btn-primary" onClick={openCreateAsset}>
                    <Plus className="w-4 h-4" /> New Asset
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>My Assets</h3>
                    {assetsLoading ? (
                        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="space-y-3">
                            {(assets || []).map((asset: any) => (
                                <div
                                    key={asset.id}
                                    className={`card p-4 cursor-pointer transition-all hover:shadow-md ${selectedAsset?.id === asset.id ? 'ring-2 ring-primary border-transparent' : ''}`}
                                    onClick={() => setSelectedAsset(asset)}
                                    style={selectedAsset?.id === asset.id ? { borderColor: 'var(--color-primary)' } : {}}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{asset.name}</h4>
                                            <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {[asset.brand, asset.model].filter(Boolean).join(' ') || asset.type || 'No brand/model'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); openEditAsset(asset); }}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); duplicateAsset(asset); }}>
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {assets?.length === 0 && (
                                <div className="text-center py-8 card border-dashed border-2">
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No assets yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {selectedAsset ? (
                        <div className="animate-fade-in space-y-6">
                            <div className="card p-6">
                                <div className="flex items-start justify-between mb-6 gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedAsset.name}</h3>
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
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => openEditAsset(selectedAsset)}>
                                            <Pencil className="w-3.5 h-3.5" /> Edit Asset
                                        </button>
                                        <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => duplicateAsset(selectedAsset)}>
                                            <Copy className="w-3.5 h-3.5" /> Duplicate Asset
                                        </button>
                                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateRecord}>
                                            <Wrench className="w-3.5 h-3.5" /> Add Log
                                        </button>
                                    </div>
                                </div>

                                {selectedAsset.note && (
                                    <div className="p-3 rounded-lg bg-gray-50 text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                                        <span className="font-bold block mb-1">NOTES</span>
                                        {selectedAsset.note}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                                        <Wrench className="w-4 h-4 text-orange-500" /> Maintenance History
                                    </h4>

                                    {recordsLoading ? (
                                        <div className="space-y-3 pt-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 w-full animate-pulse bg-gray-50 rounded-lg" />)}</div>
                                    ) : (
                                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                            {(records || []).map((record: any) => (
                                                <div key={record.id} className="py-4 first:pt-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{record.serviceType || 'Maintenance'}</span>
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {new Date(record.serviceDate).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{record.description}</p>
                                                            {record.vendor && (
                                                                <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-primary)' }}>Vendor: {record.vendor}</p>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <button type="button" className="inline-flex items-center gap-1 text-xs hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => openEditRecord(record)}>
                                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                                </button>
                                                                <button type="button" className="inline-flex items-center gap-1 text-xs hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => duplicateRecord(record)}>
                                                                    <Copy className="w-3.5 h-3.5" /> Duplicate
                                                                </button>
                                                                <button type="button" className="inline-flex items-center gap-1 text-xs hover:opacity-80" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteRecord(record.id)}>
                                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
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
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center card p-12 text-center border-dashed border-2">
                            <Package className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>Select an Asset</h3>
                            <p className="text-sm mt-1 max-w-[240px]" style={{ color: 'var(--color-text-secondary)' }}>
                                Choose an item from the left to view details and maintenance history.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {showAssetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeAssetModal}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h3>
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
                                    <input className="input" value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })} placeholder="Vehicle, Appliance..." />
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
                            <button type="submit" className="btn-primary w-full" disabled={createAssetMut.isPending || updateAssetMut.isPending}>
                                {editingAsset ? 'Save Asset' : 'Create Asset'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showRecordModal && selectedAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeRecordModal}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingRecord ? 'Edit Maintenance Log' : 'Add Maintenance Log'}</h3>
                            <button onClick={closeRecordModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRecordSubmit} className="space-y-4">
                            <div>
                                <label className="label">Service Type <span className="text-red-500">*</span></label>
                                <input className="input" value={recordForm.serviceType} onChange={(e) => setRecordForm({ ...recordForm, serviceType: e.target.value })} placeholder="Oil Change, Repair, etc." required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date <span className="text-red-500">*</span></label>
                                    <input type="date" className="input" value={recordForm.serviceDate} onChange={(e) => setRecordForm({ ...recordForm, serviceDate: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Cost</label>
                                    <input className="input" value={recordForm.cost} onChange={(e) => setRecordForm({ ...recordForm, cost: e.target.value })} placeholder="Optional" />
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
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createRecordMut.isPending || updateRecordMut.isPending}>
                                {editingRecord ? 'Save Log' : 'Create Log'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
