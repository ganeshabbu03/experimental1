import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Check, Star, X, Loader2, Box, ShieldCheck } from 'lucide-react';
import { extensionService, type OpenVSXExtension } from '@/services/extensionService';
import { usePluginStore } from '@/stores/usePluginStore';
import { useToastStore } from '@/stores/useToastStore';
import { themeService } from '@/services/themeService';

export function ExtensionDetailView() {
    const { activeExtensionDetail, setActiveExtensionDetail, installPlugin, uninstallPlugin, isInstalled } = usePluginStore();
    const { addToast } = useToastStore();
    const [fullDetail, setFullDetail] = useState<OpenVSXExtension | null>(null);
    const [readme, setReadme] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (!activeExtensionDetail) return;

        let isMounted = true;
        setLoading(true);
        setImgError(false);
        setReadme('');

        const fetchDetails = async () => {
            try {
                // Fetch full OpenVSX model details
                const detail = await extensionService.getExtensionDetails(
                    activeExtensionDetail.publisher,
                    activeExtensionDetail.extension
                );

                if (isMounted) {
                    setFullDetail(detail);

                    // Fetch the README natively through proxy or open-vsx
                    const readmeUrl = detail.files?.readme;
                    if (readmeUrl) {
                        try {
                            // Proxied via vite/backend or direct JS fetch from OpenVSX API
                            const res = await fetch(readmeUrl.startsWith('/') ? `https://open-vsx.org${readmeUrl}` : readmeUrl);
                            if (res.ok) {
                                const text = await res.text();
                                setReadme(text);
                            } else {
                                setReadme('*README not available from the publisher.*');
                            }
                        } catch (e) {
                            setReadme('*Failed to load README.*');
                        }
                    } else {
                        setReadme('*No README provided by publisher.*');
                    }
                }
            } catch (error) {
                console.error('Failed to load extension details', error);
                if (isMounted) {
                    setReadme('*Failed to load details. The extension may have been unpublished.*');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDetails();

        return () => { isMounted = false; };
    }, [activeExtensionDetail?.publisher, activeExtensionDetail?.extension]);

    if (!activeExtensionDetail) return null;

    const publisher = activeExtensionDetail.publisher;
    const extName = activeExtensionDetail.extension;
    const installed = isInstalled(publisher, extName);

    // Fallbacks since activeExtensionDetail only has partial info intially
    const displayName = fullDetail?.displayName || activeExtensionDetail.displayName || extName;
    const description = fullDetail?.description || activeExtensionDetail.description;
    const version = fullDetail?.version || activeExtensionDetail.version;
    const iconUrl = fullDetail?.iconUrl || activeExtensionDetail.iconUrl;

    const handleAction = async () => {
        if (installed) {
            uninstallPlugin(publisher, extName);
            themeService.resetTheme();
            addToast(`${displayName} uninstalled.`, 'info');
        } else {
            setInstalling(true);
            try {
                const record = await extensionService.installWorkspaceExtension(publisher, extName, version);
                installPlugin({
                    publisher: record.publisher,
                    extension: record.name,
                    version: record.version,
                    displayName: record.manifest?.displayName || displayName,
                    description: record.manifest?.description || description,
                    iconUrl,
                });
                themeService.applyPluginTheme(record.publisher, record.name, record.version);
                addToast(`Installed ${displayName}`, 'success');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                addToast(`Failed to install ${displayName}: ${message}`, 'error');
            } finally {
                setInstalling(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
            {/* Header Toolbar */}
            <div className="flex-shrink-0 h-11 border-b border-[var(--border-default)] flex items-center justify-between px-4 bg-[var(--bg-surface)]">
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Extension:</span>
                    <span>{displayName}</span>
                </div>
                <button
                    onClick={() => setActiveExtensionDetail(null)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded"
                    title="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-4 md:p-8">
                    {/* Extension Hero Section */}
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* Huge Icon */}
                        <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl bg-[rgba(124,58,237,0.05)] border border-[var(--border-default)] flex items-center justify-center overflow-hidden shadow-sm">
                            {iconUrl && !imgError ? (
                                <img
                                    src={iconUrl}
                                    alt={displayName}
                                    className="w-full h-full object-contain p-2"
                                    referrerPolicy="no-referrer"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <Box className="w-12 h-12 md:w-16 md:h-16 text-violet-500 opacity-80" />
                            )}
                        </div>

                        {/* Title and Metadata */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-1">
                                {displayName}
                            </h1>
                            <div className="flex items-center gap-2 text-sm mb-3 flex-wrap">
                                <span className="text-blue-500 hover:underline cursor-pointer font-medium">
                                    {fullDetail?.publishedBy?.fullName || publisher}
                                </span>
                                {fullDetail?.namespaceAccess === 'public' && (
                                    <span title="Verified Publisher" className="flex items-center">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    </span>
                                )}
                                <span className="text-[var(--text-muted)]">•</span>
                                <span className="text-[var(--text-secondary)]">v{version}</span>
                                <span className="text-[var(--text-muted)]">•</span>
                                <span className="text-[var(--text-secondary)] flex items-center">
                                    <Download className="w-3.5 h-3.5 mr-1" />
                                    {fullDetail ? fullDetail.downloadCount.toLocaleString() : activeExtensionDetail.downloadCount?.toLocaleString() || '0'}
                                </span>
                                {fullDetail?.averageRating ? (
                                    <>
                                        <span className="text-[var(--text-muted)]">•</span>
                                        <span className="text-[var(--text-secondary)] flex items-center">
                                            <Star className="w-3.5 h-3.5 mr-1 text-yellow-500 fill-yellow-500" />
                                            {fullDetail.averageRating.toFixed(1)}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-2xl leading-relaxed">
                                {description}
                            </p>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleAction}
                                    disabled={installing}
                                    className={`
                                        flex items-center justify-center gap-2 px-5 py-1.5 rounded text-sm font-semibold transition-colors
                                        ${installed
                                            ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] hover:bg-red-500/10 hover:text-red-500 border border-[var(--border-default)]"
                                            : "bg-[#0E639C] hover:bg-[#1177BB] text-white border border-transparent shadow-sm"
                                        }
                                        ${installing ? "opacity-70 cursor-not-allowed" : ""}
                                    `}
                                >
                                    {installing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : installed ? (
                                        <>
                                            <Check className="w-4 h-4 opacity-70" />
                                            <span>Uninstall</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Install</span>
                                        </>
                                    )}
                                </button>
                                {installed && (
                                    <div className="flex items-center text-xs text-emerald-500 font-medium px-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                                        <Check className="w-3.5 h-3.5 mr-1" /> Installed
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metadata Tabs / Badges */}
                    {fullDetail && (
                        <div className="mt-8 flex gap-4 flex-wrap border-b border-[var(--border-default)] pb-4">
                            {fullDetail.categories && fullDetail.categories.length > 0 && (
                                <div className="text-xs">
                                    <span className="text-[var(--text-muted)] mr-2">Categories</span>
                                    <div className="flex inline-flex gap-1.5 flex-wrap mt-1">
                                        {fullDetail.categories.map(c => (
                                            <span key={c} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {fullDetail.tags && fullDetail.tags.length > 0 && (
                                <div className="text-xs">
                                    <span className="text-[var(--text-muted)] mr-2">Tags</span>
                                    <div className="flex inline-flex gap-1.5 flex-wrap mt-1">
                                        {fullDetail.tags.map(t => (
                                            <span key={t} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Markdown Content */}
                    <div className="mt-8 prose prose-sm prose-invert max-w-none text-[var(--text-primary)]">
                        {loading ? (
                            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Loading README...</span>
                            </div>
                        ) : readme ? (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    img: ({ node, ...props }) => {
                                        let src = props.src;
                                        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                                            const cleanPath = src.replace(/^[\.\/]+/, '');
                                            src = `https://open-vsx.org/api/${publisher}/${extName}/${version}/file/${cleanPath}`;
                                        }
                                        return (
                                            <img
                                                {...props}
                                                src={src}
                                                className="max-w-full h-auto rounded inline-block my-2"
                                                referrerPolicy="no-referrer"
                                                alt={props.alt || "Markdown Image"}
                                                onError={(e) => {
                                                    // Hide broken markdown images to prevent standard layout breaks
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        );
                                    }
                                }}
                            >
                                {readme}
                            </ReactMarkdown>
                        ) : (
                            <div className="text-[var(--text-secondary)] italic">
                                No documentation available.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
