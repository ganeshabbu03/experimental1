/**
 * extensionService.ts
 * --------------------
 * All extension/plugin API calls go through the Deexen backend (/plugins/*),
 * which proxies OpenVSX. This module never calls OpenVSX directly.
 */

import { apiClient } from './apiClient';
import { runtimeConfig } from '@/config/runtime';
import { io } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Types — shaped to match OpenVSX API response
// ---------------------------------------------------------------------------

export interface OpenVSXExtension {
    namespaceUrl: string;
    reviewsUrl: string;
    files: Record<string, string>;
    name: string;                  // extension id, e.g. "python"
    namespace: string;             // publisher, e.g. "ms-python"
    publishedBy: {
        loginName: string;
        fullName?: string;
        avatarUrl?: string;
    };
    namespaceAccess: string;
    allVersionsUrl: string;
    version: string;               // latest version
    timestamp: string;
    preRelease?: boolean;
    displayName: string;
    description: string;
    categories?: string[];
    tags?: string[];
    license?: string;
    homepage?: string;
    repository?: string;
    downloadCount: number;         // total downloads across all versions
    averageRating?: number;
    reviewCount?: number;
    downloadUrl?: string;          // direct .vsix URL
    iconUrl?: string;
}

export interface SearchResult {
    offset: number;
    totalSize: number;
    extensions: OpenVSXExtension[];
}

export interface DownloadResult {
    status: 'ok' | 'error';
    message: string;
    path?: string;
    size_bytes?: number;
}

export interface ExtensionInstallProgressEvent {
    stage: 'queued' | 'downloading' | 'extracting' | 'installing' | 'complete' | 'error';
    progress: number;
    message: string;
    size_bytes?: number;
}

export interface WorkspaceExtensionRecord {
    id: string;
    publisher: string;
    name: string;
    version: string;
    manifest?: {
        displayName?: string;
        description?: string;
    };
}

interface WorkspaceExtensionResponse {
    ok?: boolean;
    error?: string;
    requiresTrust?: boolean;
    publisher?: string;
    record?: WorkspaceExtensionRecord;
}

const connectWorkspaceSocket = async () => {
    const socket = io(runtimeConfig.wsBaseUrl, {
        transports: ['websocket', 'polling'],
    });

    await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
        };

        const onConnect = () => {
            cleanup();
            resolve();
        };

        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
    });

    return socket;
};

const emitWorkspaceExtensionEvent = async <T>(
    event: string,
    payload: Record<string, unknown>,
): Promise<T> => {
    const socket = await connectWorkspaceSocket();

    try {
        return await socket.timeout(30000).emitWithAck(event, payload) as T;
    } finally {
        socket.disconnect();
    }
};

const parseSsePayload = (chunk: string): ExtensionInstallProgressEvent[] => {
    const normalizedChunk = chunk.replace(/\r\n/g, '\n');
    const payloads = normalizedChunk
        .split('\n\n')
        .map((entry) =>
            entry
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim())
                .join('')
        )
        .filter(Boolean);

    return payloads.map((payload) => JSON.parse(payload) as ExtensionInstallProgressEvent);
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const extensionService = {
    /**
     * Search OpenVSX extensions.
     * Uses our backend proxy endpoint: /plugins/search
     */
    async searchExtensions(
        query: string = '',
        offset: number = 0,
        size: number = 20,
        category: string = ''
    ): Promise<SearchResult> {
        const result = await apiClient.get<SearchResult>(
            `/plugins/search?q=${encodeURIComponent(query)}&offset=${offset}&size=${size}&category=${encodeURIComponent(category)}`
        );
        if (result.extensions) {
            result.extensions = result.extensions.map(ext => {
                // If the extension has a valid icon listed in files, use our backend proxy
                // Otherwise fall back to a generic default or leave it undefined to trigger the Box placeholder
                let iconUrl = undefined;
                if (ext.iconUrl || ext.files?.icon) {
                    iconUrl = `${apiClient.baseUrl}/plugins/icon/${ext.namespace}/${ext.name}/${ext.version}`;
                }

                return {
                    ...ext,
                    iconUrl
                };
            });
        }
        return result;
    },

    /**
     * Get detailed metadata for a specific extension, including the README.
     * Uses our backend proxy endpoint: /plugins/details/{publisher}/{extension}
     */
    async getExtensionDetails(publisher: string, extension: string): Promise<OpenVSXExtension> {
        const ext = await apiClient.get<OpenVSXExtension>(`/plugins/details/${publisher}/${extension}`);
        if (ext.iconUrl || ext.files?.icon) {
            ext.iconUrl = `${apiClient.baseUrl}/plugins/icon/${ext.namespace}/${ext.name}/${ext.version}`;
        } else {
            ext.iconUrl = undefined;
        }
        return ext;
    },

    /**
     * Trigger backend to download the .vsix and save it locally.
     */
    async downloadExtension(
        publisher: string,
        extension: string,
        version: string,
    ): Promise<DownloadResult> {
        return apiClient.get<DownloadResult>(
            `/plugins/download/${publisher}/${extension}/${version}`,
        );
    },

    async downloadExtensionWithProgress(
        publisher: string,
        extension: string,
        version: string,
        onProgress?: (event: ExtensionInstallProgressEvent) => void,
    ): Promise<ExtensionInstallProgressEvent> {
        const response = await fetch(
            `${apiClient.baseUrl}/plugins/download/${publisher}/${extension}/${version}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'text/event-stream',
                },
            },
        );

        if (!response.ok) {
            throw new Error(`Failed to download ${publisher}.${extension} (HTTP ${response.status})`);
        }

        if (!response.body) {
            throw new Error('Download stream is not available in this browser.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let latestEvent: ExtensionInstallProgressEvent = {
            stage: 'queued',
            progress: 0,
            message: 'Preparing secure download...',
        };

        onProgress?.(latestEvent);

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const normalizedBuffer = buffer.replace(/\r\n/g, '\n');
            const segments = normalizedBuffer.split('\n\n');
            buffer = segments.pop() || '';

            for (const segment of segments) {
                const events = parseSsePayload(segment);
                for (const event of events) {
                    latestEvent = event;
                    onProgress?.(event);

                    if (event.stage === 'error') {
                        throw new Error(event.message);
                    }
                }
            }

            if (done) {
                if (buffer.trim()) {
                    const trailingEvents = parseSsePayload(buffer);
                    for (const event of trailingEvents) {
                        latestEvent = event;
                        onProgress?.(event);
                        if (event.stage === 'error') {
                            throw new Error(event.message);
                        }
                    }
                }
                break;
            }
        }

        return latestEvent;
    },

    /**
     * Delete the downloaded and extracted .vsix files from the backend storage.
     */
    async uninstallExtension(publisher: string, extension: string): Promise<{ status: string }> {
        return apiClient.delete<{ status: string }>(`/plugins/uninstall/${publisher}/${extension}`);
    },

    async installWorkspaceExtension(
        publisher: string,
        extension: string,
        version?: string,
    ): Promise<WorkspaceExtensionRecord> {
        const response = await emitWorkspaceExtensionEvent<WorkspaceExtensionResponse>(
            'extensions.install',
            {
                publisher,
                name: extension,
                version,
                trustPublisher: true,
            },
        );

        if (!response?.ok || !response.record) {
            throw new Error(response?.error || `Failed to install ${publisher}.${extension}`);
        }

        return response.record;
    },

    async installExtensionWithProgress(
        publisher: string,
        extension: string,
        version: string,
        onProgress?: (event: ExtensionInstallProgressEvent) => void,
    ): Promise<WorkspaceExtensionRecord> {
        await this.downloadExtensionWithProgress(publisher, extension, version, onProgress);

        onProgress?.({
            stage: 'installing',
            progress: 100,
            message: 'Activating extension in your workspace...',
        });

        try {
            const record = await this.installWorkspaceExtension(publisher, extension, version);
            onProgress?.({
                stage: 'complete',
                progress: 100,
                message: `Installed ${publisher}.${extension} successfully`,
            });
            return record;
        } catch (error) {
            const message = error instanceof Error ? error.message : `Failed to install ${publisher}.${extension}`;
            onProgress?.({
                stage: 'error',
                progress: 100,
                message,
            });
            throw error;
        }
    },

    async uninstallWorkspaceExtension(
        publisher: string,
        extension: string,
    ): Promise<void> {
        const response = await emitWorkspaceExtensionEvent<WorkspaceExtensionResponse>(
            'extensions.uninstall',
            { extensionId: `${publisher}.${extension}` },
        );

        if (!response?.ok) {
            throw new Error(response?.error || `Failed to uninstall ${publisher}.${extension}`);
        }
    },
};
