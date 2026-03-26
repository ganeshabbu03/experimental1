/**
 * SidebarExtensionList.tsx
 * -------------------------
 * A compact version of the marketplace designed specifically for
 * the narrow sidebar in the Workspace view.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { extensionService, type OpenVSXExtension } from '@/services/extensionService';
import { usePluginStore } from '@/stores/usePluginStore';
import { useToastStore } from '@/stores/useToastStore';
import { themeService } from '@/services/themeService';
import { Search, Loader2, Download, Check, Box } from 'lucide-react';

export function SidebarExtensionList() {
    const [query, setQuery] = useState('');
    const [extensions, setExtensions] = useState<OpenVSXExtension[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { installedPlugins, installPlugin, uninstallPlugin, isInstalled, setActiveExtensionDetail } = usePluginStore();
    const { addToast } = useToastStore();

    const fetchExtensions = useCallback(async (q: string) => {
        setLoading(true);
        try {
            // For the sidebar, we just fetch a small number of results
            const result = await extensionService.searchExtensions(q, 0, 20);
            setExtensions(result.extensions ?? []);
        } catch {
            setExtensions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load - Empty query returns popular extensions
    useEffect(() => {
        fetchExtensions('');
    }, [fetchExtensions]);

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchExtensions(value);
        }, 600);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-surface)] text-[var(--text-primary)]">
            <div className="p-3 border-b border-[var(--border-default)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder="Search extensions..."
                        className="w-full bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded px-8 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    {loading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-500 animate-spin" />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {query === '' && installedPlugins.length > 0 && (
                    <div className="mb-4">
                        <div className="px-2 pb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            Installed
                        </div>
                        <div className="space-y-2">
                            {installedPlugins.map(p => (
                                <SidebarExtensionCard
                                    key={`installed-${p.publisher}-${p.extension}`}
                                    extension={{
                                        namespace: p.publisher,
                                        name: p.extension,
                                        version: p.version,
                                        displayName: p.displayName,
                                        description: p.description || '',
                                        iconUrl: p.iconUrl,
                                        downloadCount: 0,
                                        files: {},
                                        timestamp: p.installedAt,
                                        namespaceUrl: '', reviewsUrl: '', publishedBy: { loginName: p.publisher }, namespaceAccess: '', allVersionsUrl: ''
                                    }}
                                    installed={true}
                                    onInstall={async () => { }}
                                    onUninstall={() => {
                                        uninstallPlugin(p.publisher, p.extension);
                                        themeService.resetTheme();
                                    }}
                                    onClick={() => setActiveExtensionDetail({
                                        publisher: p.publisher,
                                        extension: p.extension,
                                        version: p.version,
                                        displayName: p.displayName,
                                        description: p.description,
                                        iconUrl: p.iconUrl,
                                        installedAt: p.installedAt,
                                        downloadCount: 0
                                    })}
                                />
                            ))}
                        </div>
                        <div className="px-2 pt-4 pb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-4">
                            Recommended
                        </div>
                    </div>
                )}

                {extensions.map(ext => {
                    // Don't show in search results if already installed (prevent duplicates in default view)
                    if (query === '' && isInstalled(ext.namespace, ext.name)) return null;

                    return (
                        <SidebarExtensionCard
                            key={`${ext.namespace}-${ext.name}`}
                            extension={ext}
                            installed={isInstalled(ext.namespace, ext.name)}
                            onInstall={async () => {
                                try {
                                    const record = await extensionService.installWorkspaceExtension(ext.namespace, ext.name, ext.version);
                                    installPlugin({
                                        publisher: record.publisher,
                                        extension: record.name,
                                        version: record.version,
                                        displayName: record.manifest?.displayName || ext.displayName,
                                        description: record.manifest?.description || ext.description,
                                        iconUrl: ext.iconUrl,
                                    });
                                    // Try to apply it as a theme right away
                                    themeService.applyPluginTheme(record.publisher, record.name, record.version);
                                    addToast(`Installed ${ext.displayName}`, 'success', 3000);
                                } catch (error) {
                                    const message = error instanceof Error ? error.message : 'Unknown error';
                                    addToast(`Failed to install ${ext.displayName}: ${message}`, 'error', 4000);
                                }
                            }}
                            onUninstall={() => {
                                uninstallPlugin(ext.namespace, ext.name);
                                themeService.resetTheme();
                            }}
                            onClick={() => setActiveExtensionDetail({
                                publisher: ext.namespace,
                                extension: ext.name,
                                version: ext.version,
                                displayName: ext.displayName,
                                description: ext.description,
                                iconUrl: ext.iconUrl,
                                installedAt: new Date().toISOString(),
                                downloadCount: ext.downloadCount
                            })}
                        />
                    );
                })}

                {!loading && extensions.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-[var(--text-secondary)] text-xs text-center">
                        <Box className="w-8 h-8 opacity-20 mb-2" />
                        <p>No extensions found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Compact card optimized for the sidebar
function SidebarExtensionCard(props: { extension: OpenVSXExtension, installed: boolean, onInstall: () => Promise<void>, onUninstall: () => void, onClick?: () => void }) {
    const { extension, installed, onInstall, onUninstall, onClick } = props;
    const [loading, setLoading] = useState(false);
    const [imgError, setImgError] = useState(false);

    const handleAction = async () => {
        if (installed) {
            onUninstall();
        } else {
            setLoading(true);
            await onInstall();
            setLoading(false);
        }
    };

    return (
        <div className="flex gap-3 p-2 rounded hover:bg-[var(--bg-surface-hover)] transition-colors group cursor-pointer" onClick={onClick}>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[rgba(124,58,237,0.1)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {extension.iconUrl && !imgError ? (
                        <img
                            src={extension.iconUrl}
                            alt={extension.displayName}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Box className="w-4 h-4 text-violet-500" />
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {extension.displayName || extension.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {extension.description}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center pr-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAction();
                    }}
                    disabled={loading}
                    title={installed ? "Uninstall" : "Install"}
                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${installed
                        ? "text-emerald-500 hover:bg-red-500/10 hover:text-red-500"
                        : "text-[var(--text-secondary)] hover:text-orange-500 hover:bg-orange-500/10"
                        }`}
                >
                    {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : installed ? (
                        <Check className="w-3.5 h-3.5" />
                    ) : (
                        <Download className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>
        </div>
    );
}
