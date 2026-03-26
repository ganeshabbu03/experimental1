/**
 * usePluginStore.ts
 * -----------------
 * Zustand store for tracking installed plugins.
 * State is persisted to localStorage so the installed list survives page reloads.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { extensionService } from '@/services/extensionService';

export interface InstalledPlugin {
    publisher: string;
    extension: string;
    version: string;
    displayName: string;
    description?: string;
    iconUrl?: string;
    installedAt: string; // ISO timestamp
}

// Full metadata from OpenVSX (has README, tags, etc.)
export interface ExtensionDetail extends InstalledPlugin {
    readmeContent?: string;
    downloadCount: number;
    categories?: string[];
    tags?: string[];
    license?: string;
    homepage?: string;
    repository?: string;
}

interface PluginState {
    installedPlugins: InstalledPlugin[];
    activeExtensionDetail: ExtensionDetail | null;

    /** Mark a plugin as installed. No-op if already installed. */
    installPlugin: (plugin: Omit<InstalledPlugin, 'installedAt'>) => void;

    /** Remove an installed plugin by publisher + extension name. */
    uninstallPlugin: (publisher: string, extension: string) => void;

    /** Check whether a given publisher/extension pair is installed. */
    isInstalled: (publisher: string, extension: string) => boolean;

    /** Set the currently viewed extension for the main Editor pane */
    setActiveExtensionDetail: (extensionDetail: ExtensionDetail | null) => void;
}

export const usePluginStore = create<PluginState>()(
    persist(
        (set, get) => ({
            installedPlugins: [],
            activeExtensionDetail: null,

            installPlugin: (plugin) => {
                // Prevent duplicate entries
                if (get().isInstalled(plugin.publisher, plugin.extension)) return;

                set((state) => ({
                    installedPlugins: [
                        ...state.installedPlugins,
                        { ...plugin, installedAt: new Date().toISOString() },
                    ],
                }));
            },

            uninstallPlugin: (publisher, extension) => {
                // Fire and forget: tell the workspace backend to unload and remove the extension.
                extensionService.uninstallWorkspaceExtension(publisher, extension).catch(err => {
                    console.error('Failed to uninstall on backend:', err);
                });

                set((state) => ({
                    installedPlugins: state.installedPlugins.filter(
                        (p) => !(p.publisher === publisher && p.extension === extension)
                    ),
                }));
            },

            isInstalled: (publisher, extension) => {
                return get().installedPlugins.some(
                    (p) => p.publisher === publisher && p.extension === extension
                );
            },

            setActiveExtensionDetail: (extensionDetail) => set({ activeExtensionDetail: extensionDetail }),
        }),
        {
            name: 'deexen-installed-plugins', // localStorage key
        }
    )
);
