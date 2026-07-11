import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import {
    deleteAgentKey,
    discoverAgentModels,
    saveAgentSettings,
    testAgentConnection,
    useAgentSettings,
    useRefreshAgentSettings,
    type AgentEffort,
    type AgentProvider,
} from '../../api/agentSettings';

const PROVIDERS: Array<{ id: AgentProvider; label: string }> = [
    { id: 'OPENAI', label: 'OpenAI' },
    { id: 'ANTHROPIC', label: 'Claude' },
    { id: 'OPENAI_COMPATIBLE', label: 'Custom (OpenAI compatible)' },
];

export default function AgentSettingsPage() {
    const { data, isLoading } = useAgentSettings();
    const refreshSettings = useRefreshAgentSettings();
    const [provider, setProvider] = useState<AgentProvider>('OPENAI');
    const [model, setModel] = useState('');
    const [effort, setEffort] = useState<AgentEffort>('auto');
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [models, setModels] = useState<Array<{ id: string; name?: string }>>([]);
    const [busy, setBusy] = useState<'save' | 'models' | 'test' | 'delete' | null>(null);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    const status = useMemo(() => data?.providers.find((item) => item.provider === provider), [data, provider]);

    useEffect(() => {
        if (data) setProvider(data.activeProvider);
    }, [data?.activeProvider]);

    useEffect(() => {
        if (!status) return;
        setModel(status.model);
        setEffort(status.effort);
        setBaseUrl(status.baseUrl ?? '');
        setApiKey('');
        setModels([]);
        setMessage(null);
    }, [status?.provider, status?.model, status?.effort, status?.baseUrl]);

    const payload = () => ({
        activeProvider: provider,
        model: model.trim(),
        effort,
        ...(provider === 'OPENAI_COMPATIBLE' ? { baseUrl: baseUrl.trim() } : {}),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        useSavedKey: !apiKey.trim(),
    });

    const errorText = (error: any) => error?.response?.data?.message || 'Request failed';

    if (isLoading || !data) return <div className="p-6" style={{ color: 'var(--color-text-secondary)' }}>Loading agent settings...</div>;

    return (
        <div className="space-y-6 pb-20 lg:pb-0 max-w-4xl">
            <div className="flex items-center gap-3">
                <Bot className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Agent Settings</h2>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Configure the AI provider used to understand assistant requests.</p>
                </div>
            </div>

            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.kind === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {message.kind === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            <div className="card p-6 space-y-5">
                <div>
                    <label className="label" htmlFor="agent-provider">Provider</label>
                    <select id="agent-provider" className="input max-w-md" value={provider} onChange={(event) => setProvider(event.target.value as AgentProvider)}>
                        {PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                </div>

                {provider === 'OPENAI_COMPATIBLE' && (
                    <div>
                        <label className="label" htmlFor="agent-base-url">Base URL</label>
                        <input id="agent-base-url" className="input max-w-xl" placeholder="https://provider.example/v1" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
                    </div>
                )}

                <div>
                    <label className="label" htmlFor="agent-api-key">API key</label>
                    {status?.keySource && (
                        <div className="flex items-center gap-3 mb-2 text-sm">
                            <span className="font-mono" style={{ color: 'var(--color-text)' }}>••••••••{status.keyLast4}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{status.keySource === 'env' ? 'server environment' : 'encrypted database'}</span>
                            {status.keySource === 'db' && (
                                <button type="button" title="Delete saved API key" className="p-1 text-red-600" disabled={busy !== null} onClick={async () => {
                                    if (!window.confirm('Delete this provider API key?')) return;
                                    setBusy('delete');
                                    try { await deleteAgentKey(provider); await refreshSettings(); setMessage({ kind: 'success', text: 'API key deleted.' }); }
                                    catch (error) { setMessage({ kind: 'error', text: errorText(error) }); }
                                    finally { setBusy(null); }
                                }}><Trash2 className="w-4 h-4" /></button>
                            )}
                        </div>
                    )}
                    <input id="agent-api-key" className="input max-w-xl" type="password" autoComplete="new-password" placeholder={status?.keySource ? 'Leave blank to keep the current key' : provider === 'OPENAI_COMPATIBLE' ? 'Optional API key' : 'Enter API key'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4 max-w-2xl">
                    <div>
                        <label className="label" htmlFor="agent-model">Model</label>
                        <input id="agent-model" list="agent-model-options" className="input" value={model} onChange={(event) => setModel(event.target.value)} />
                        <datalist id="agent-model-options">{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
                    </div>
                    <div>
                        <label className="label" htmlFor="agent-effort">Effort</label>
                        <select id="agent-effort" className="input" value={effort} onChange={(event) => setEffort(event.target.value as AgentEffort)}>
                            <option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" className="btn-secondary flex items-center gap-2" disabled={busy !== null || !model.trim()} onClick={async () => {
                        setBusy('models'); setMessage(null);
                        try { setModels(await discoverAgentModels(payload())); setMessage({ kind: 'success', text: 'Model list refreshed.' }); }
                        catch (error) { setMessage({ kind: 'error', text: `${errorText(error)} You can enter a model ID manually.` }); }
                        finally { setBusy(null); }
                    }}>{busy === 'models' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Load models</button>
                    <button type="button" className="btn-secondary" disabled={busy !== null || !model.trim()} onClick={async () => {
                        setBusy('test'); setMessage(null);
                        try {
                            const result = await testAgentConnection(payload());
                            setMessage(result.success ? { kind: 'success', text: `Connection succeeded in ${result.latencyMs} ms.` } : { kind: 'error', text: result.error?.message || 'Connection failed.' });
                        } catch (error) { setMessage({ kind: 'error', text: errorText(error) }); }
                        finally { setBusy(null); }
                    }}>Test connection</button>
                    <button type="button" className="btn-primary" disabled={busy !== null || !model.trim() || (provider === 'OPENAI_COMPATIBLE' && !baseUrl.trim())} onClick={async () => {
                        setBusy('save'); setMessage(null);
                        try { await saveAgentSettings(payload()); setApiKey(''); await refreshSettings(); setMessage({ kind: 'success', text: 'Agent settings saved.' }); }
                        catch (error) { setMessage({ kind: 'error', text: errorText(error) }); }
                        finally { setBusy(null); }
                    }}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}
