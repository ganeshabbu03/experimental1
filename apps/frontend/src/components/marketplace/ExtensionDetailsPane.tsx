import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Box, ArrowLeft, ExternalLink, Activity } from 'lucide-react';
import { usePluginStore, type ExtensionDetail } from '@/stores/usePluginStore';
import { extensionService } from '@/services/extensionService';
import { useToastStore } from '@/stores/useToastStore';

export function ExtensionDetailsPane() {
    const { activeExtensionDetail, setActiveExtensionDetail, installPlugin, uninstallPlugin, isInstalled } = usePluginStore();
    const { addToast } = useToastStore();
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState<ExtensionDetail | null>(null);

    // Fetch full README details once open
    useEffect(() => {
        if (!activeExtensionDetail) return;

        let active = true;
        setLoading(true);

        extensionService.getExtensionDetails(activeExtensionDetail.publisher, activeExtensionDetail.extension)
            .then((data) => {
                if (!active) return;

                // Merge the base summary from summary-card with the full metadata
                setDetails({
                    ...activeExtensionDetail,
                    downloadCount: data.downloadCount ?? activeExtensionDetail.downloadCount ?? 0,
                    categories: data.categories,
                    tags: data.tags,
                    license: data.license,
                    homepage: data.homepage,
                    repository: data.repository,
                    // OpenVSX puts the README inside the files object or we have to query it.
                    // If it's pure markdown, we dump it into readmeContent.
                    readmeContent: data.description || 'No detailed README available.',
                });
            })
            .catch(() => {
                if (active) {
                    addToast('Failed to load extension details.', 'error');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [activeExtensionDetail?.publisher, activeExtensionDetail?.extension]);

    if (!activeExtensionDetail) return null;

    const displayInfo = details || activeExtensionDetail;
    const publisher = displayInfo.publisher;
    const extName = displayInfo.extension;
    const installed = isInstalled(publisher, extName);

    const formatDownloads = (n: number) => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return String(n);
    };

    const handleInstall = async () => {
        if (installed || loading) return;
        setLoading(true);
        try {
            await extensionService.downloadExtension(publisher, extName, displayInfo.version);
            installPlugin({
                publisher,
                extension: extName,
                version: displayInfo.version,
                displayName: displayInfo.displayName,
                description: displayInfo.description,
                iconUrl: displayInfo.iconUrl,
            });
            addToast(`✅ ${displayInfo.displayName} installed successfully!`, 'success', 4000);
        } catch {
            addToast(`Failed to install ${displayInfo.displayName}.`, 'error', 4000);
        } finally {
            setLoading(false);
        }
    };

    const handleUninstall = () => {
        uninstallPlugin(publisher, extName);
        addToast(`${displayInfo.displayName} uninstalled.`, 'info', 3000);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
            <div className="flex items-center px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] shrink-0 gap-4">
                <button
                    onClick={() => setActiveExtensionDetail(null)}
                    className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)]"
                    title="Close Details"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="w-16 h-16 rounded overflow-hidden bg-black/20 shrink-0 flex items-center justify-center">
                    {displayInfo.iconUrl ? (
                        <img src={displayInfo.iconUrl} alt={displayInfo.displayName} className="w-full h-full object-cover" />
                    ) : (
                        <Box size={32} className="text-[var(--text-secondary)]" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-medium tracking-tight truncate">{displayInfo.displayName || displayInfo.extension}</h1>
                    <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] mt-1">
                        <span className="text-orange-400 font-medium">{displayInfo.publisher}</span>
                        <span className="flex items-center gap-1"><Download size={14} /> {formatDownloads(displayInfo.downloadCount || 0)}</span>
                        <span>v{displayInfo.version}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 w-32">
                    {installed ? (
                        <button
                            onClick={handleUninstall}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-1.5 px-3 rounded text-sm font-medium transition-colors w-full"
                        >
                            Uninstall
                        </button>
                    ) : (
                        <button
                            onClick={handleInstall}
                            disabled={loading}
                            className="bg-orange-500 hover:bg-orange-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Activity className="animate-spin" size={14} />
                            ) : (
                                <>
                                    <Download size={14} /> Install
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--bg-canvas)]">
                <div className="max-w-4xl mx-auto p-8">
                    {/* Tags and Links */}
                    {details && (
                        <div className="flex flex-wrap gap-4 mb-8">
                            {details.categories?.map(c => (
                                <span key={c} className="px-2.5 py-1 rounded bg-[var(--bg-surface-hover)] text-[11px] font-medium text-[var(--text-secondary)]">
                                    {c}
                                </span>
                            ))}
                            <div className="w-px h-5 bg-[var(--border-default)] mx-2 my-auto" />
                            {details.repository && (
                                <a href={details.repository} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-orange-400 hover:underline">
                                    <ExternalLink size={14} /> Repository
                                </a>
                            )}
                            {details.homepage && (
                                <a href={details.homepage} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-orange-400 hover:underline">
                                    <ExternalLink size={14} /> Homepage
                                </a>
                            )}
                        </div>
                    )}

                    {/* Markdown rendering */}
                    <div className="prose prose-invert prose-orange max-w-none text-sm text-[var(--text-secondary)] mt-8 pb-12">
                        {details ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {details.readmeContent || displayInfo.description}
                            </ReactMarkdown>
                        ) : (
                            <div className="animate-pulse bg-[var(--bg-surface-hover)] h-32 rounded"></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
