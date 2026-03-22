/**
 * ExtensionCard.tsx
 * ------------------
 * Display card for a single OpenVSX extension.
 * Shows publisher, name, description, version, download count.
 * Install button triggers backend download + updates the plugin store.
 */

import { useState } from 'react';
import { Download, Check, Box, Star, TrendingUp } from 'lucide-react';
import { extensionService, type OpenVSXExtension } from '@/services/extensionService';
import { usePluginStore } from '@/stores/usePluginStore';
import { useToastStore } from '@/stores/useToastStore';

interface ExtensionCardProps {
    extension: OpenVSXExtension;
    /** Extra badge shown for trending plugins */
    isTrending?: boolean;
    onClick?: () => void;
}

function formatDownloads(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

export function ExtensionCard(props: ExtensionCardProps) {
    const { extension, isTrending = false } = props;
    const [loading, setLoading] = useState(false);
    const [imgError, setImgError] = useState(false);
    const { installPlugin, uninstallPlugin, isInstalled } = usePluginStore();
    const { addToast } = useToastStore();

    const publisher = extension.namespace;
    const extName = extension.name;
    const installed = isInstalled(publisher, extName);

    const handleInstall = async () => {
        if (installed || loading) return;
        setLoading(true);
        try {
            await extensionService.downloadExtension(publisher, extName, extension.version);
            installPlugin({
                publisher,
                extension: extName,
                version: extension.version,
                displayName: extension.displayName,
                description: extension.description,
                iconUrl: extension.iconUrl,
            });
            addToast(`✅ ${extension.displayName} installed successfully!`, 'success', 4000);
        } catch {
            addToast(`Failed to install ${extension.displayName}. Please try again.`, 'error', 4000);
        } finally {
            setLoading(false);
        }
    };

    const handleUninstall = () => {
        uninstallPlugin(publisher, extName);
        addToast(`${extension.displayName} uninstalled.`, 'info', 3000);
    };

    return (
        <div className="ext-card cursor-pointer hover:border-orange-500 transition-colors" onClick={props.onClick}>
            {/* Icon + version row */}
            <div className="ext-card__header">
                <div className="ext-card__icon">
                    {extension.iconUrl && !imgError ? (
                        <img
                            src={extension.iconUrl}
                            alt={extension.displayName}
                            className="ext-card__icon-img"
                            referrerPolicy="no-referrer"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Box className="ext-card__icon-fallback" />
                    )}
                </div>

                <div className="ext-card__badges">
                    {isTrending && (
                        <span className="ext-badge ext-badge--trending">
                            <TrendingUp size={10} /> Trending
                        </span>
                    )}
                    <span className="ext-badge ext-badge--version">v{extension.version}</span>
                </div>
            </div>

            {/* Name + publisher */}
            <h3 className="ext-card__name">{extension.displayName || extName}</h3>
            <p className="ext-card__publisher">
                by <span>{extension.publishedBy?.loginName || publisher}</span>
            </p>

            {/* Description */}
            <p className="ext-card__description">{extension.description || 'No description available.'}</p>

            {/* Footer: downloads + action */}
            <div className="ext-card__footer">
                <div className="ext-card__stats">
                    <Download size={12} />
                    <span>{formatDownloads(extension.downloadCount ?? 0)}</span>
                    {(extension.averageRating ?? 0) > 0 && (
                        <>
                            <Star size={12} className="ext-card__star" />
                            <span>{(extension.averageRating ?? 0).toFixed(1)}</span>
                        </>
                    )}
                </div>

                {installed ? (
                    <button
                        onClick={handleUninstall}
                        className="ext-btn ext-btn--installed"
                        title="Click to uninstall"
                    >
                        <Check size={13} />
                        Installed
                    </button>
                ) : (
                    <button
                        onClick={handleInstall}
                        disabled={loading}
                        className={`ext-btn ext-btn--install${loading ? ' ext-btn--loading' : ''}`}
                    >
                        {loading ? (
                            <span className="ext-btn__spinner" />
                        ) : (
                            <Download size={13} />
                        )}
                        {loading ? 'Installing…' : 'Install'}
                    </button>
                )}
            </div>
        </div>
    );
}
