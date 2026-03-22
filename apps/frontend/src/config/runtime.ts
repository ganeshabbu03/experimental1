const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeUrl = (value: string | undefined, fallback: string): string => {
    const candidate = value?.trim();
    return stripTrailingSlash(candidate && candidate.length > 0 ? candidate : fallback);
};

const apiFallback = 'http://localhost:8000';
const workspaceFallback = 'http://localhost:3000';

export const runtimeConfig = {
    apiUrl: normalizeUrl(import.meta.env.VITE_API_URL, apiFallback),
    workspaceApiUrl: normalizeUrl(import.meta.env.VITE_WORKSPACE_API_URL, workspaceFallback),
    wsBaseUrl: normalizeUrl(import.meta.env.VITE_WS_URL || import.meta.env.VITE_WORKSPACE_API_URL, workspaceFallback),
};

export const toWebSocketBase = (url: string): string => {
    if (url.startsWith('https://')) {
        return `wss://${url.slice('https://'.length)}`;
    }
    if (url.startsWith('http://')) {
        return `ws://${url.slice('http://'.length)}`;
    }
    return url;
};
