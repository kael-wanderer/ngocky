import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Package, Plus, X, Wrench, Calendar, Trash2, ExternalLink } from 'lucide-react';

export default function AssetsPage() {
    const qc = useQueryClient();
    const [showCreateAsset, setShowCreateAsset] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [showAddRecord, setShowAddRecord] = useState(false);

    const { data: assets, isLoading: assetsLoading } = useQuery({
        queryKey: ['assets'],
        queryFn: async () => (await api.get('/assets')).data.data,
    });

    const createAssetMut = useMutation({
        mutationFn: (body: any) => api.post('/assets', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setShowCreateAsset(false); },
    });

    const deleteAssetMut = useMutation({
        mutationFn: (id: string) => api.delete(`/assets/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
    });

    const addRecordMut = useMutation({
        mutationFn: ({ assetId, body }: { assetId: string, body: any }) => api.post(`/assets/${assetId}/maintenance`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance', selectedAsset?.id] }); setShowAddRecord(false); },
    });

    const { data: records, isLoading: recordsLoading } = useQuery({
        queryKey: ['maintenance', selectedAsset?.id],
        queryFn: async () => (await api.get(`/assets/${selectedAsset.id}/maintenance`)).data.data,
        enabled: !!selectedAsset,
    });

    const [assetForm, setAssetForm] = useState({ name: '', type: '', brand: '', model: '', serialNumber: '', purchaseDate: '', note: '' });
    const [recordForm, setRecordForm] = useState({ serviceDate: new Date().toISOString().split('T')[0], serviceType: '', description: '', cost: 0, vendor: '', nextRecommendedDate: '' });

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Assets & Maintenance</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateAsset(true)}>
                    <Plus className="w-4 h-4" /> New Asset
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Assets List */}
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
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{asset.name}</h4>
                                            <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {asset.brand} {asset.model}
                                            </p>
                                        </div>
                                        <button
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this asset?')) deleteAssetMut.mutate(asset.id); }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
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

                {/* Asset Details & Records */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedAsset ? (
                        <div className="animate-fade-in space-y-6">
                            <div className="card p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedAsset.name}</h3>
                                        <div className="flex flex-wrap gap-4 mt-2">
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
                                    <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => setShowAddRecord(true)}>
                                        <Wrench className="w-3.5 h-3.5" /> Add Log
                                    </button>
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
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{record.serviceType}</span>
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {new Date(record.serviceDate).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{record.description}</p>
                                                            {record.vendor && (
                                                                <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-primary)' }}>Vendor: {record.vendor}</p>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            {record.cost > 0 && (
                                                                <span className="text-sm font-bold block" style={{ color: 'var(--color-text)' }}>
                                                                    ${record.cost.toLocaleString()}
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

            {/* Create Asset Modal */}
            {showCreateAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreateAsset(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add New Asset</h3>
                            <button onClick={() => setShowCreateAsset(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                createAssetMut.mutate({
                                    ...assetForm,
                                    purchaseDate: assetForm.purchaseDate ? new Date(assetForm.purchaseDate).toISOString() : null
                                });
                            }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="label">Name <span className="text-red-500">*</span></label>
                                    <input className="input" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. Family Van, Fridge" required />
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
                                <div>
                                    <label className="label">Purchase Date</label>
                                    <input type="date" className="input" value={assetForm.purchaseDate} onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Note</label>
                                    <textarea className="input" rows={2} value={assetForm.note} onChange={(e) => setAssetForm({ ...assetForm, note: e.target.value })} placeholder="Any additional details..." />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createAssetMut.isPending}>
                                {createAssetMut.isPending ? 'Saving...' : 'Save Asset'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Maintenance Record Modal */}
            {showAddRecord && selectedAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddRecord(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add Maintenance Log</h3>
                            <button onClick={() => setShowAddRecord(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                addRecordMut.mutate({
                                    assetId: selectedAsset.id,
                                    body: {
                                        ...recordForm,
                                        serviceDate: new Date(recordForm.serviceDate).toISOString(),
                                        nextRecommendedDate: recordForm.nextRecommendedDate ? new Date(recordForm.nextRecommendedDate).toISOString() : null,
                                        cost: parseFloat(recordForm.cost.toString())
                                    }
                                });
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="label">Service Type</label>
                                <input className="input" value={recordForm.serviceType} onChange={(e) => setRecordForm({ ...recordForm, serviceType: e.target.value })} placeholder="Oil Change, Repair, etc." required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date</label>
                                    <input type="date" className="input" value={recordForm.serviceDate} onChange={(e) => setRecordForm({ ...recordForm, serviceDate: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Cost</label>
                                    <input type="number" step="0.01" className="input" value={recordForm.cost} onChange={(e) => setRecordForm({ ...recordForm, cost: parseFloat(e.target.value) })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Description</label>
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
                            <button type="submit" className="btn-primary w-full" disabled={addRecordMut.isPending}>
                                {addRecordMut.isPending ? 'Saving...' : 'Save Log'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
