const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const isBrowser = typeof window !== 'undefined';

const getHostName = (): string => (isBrowser ? window.location.hostname : 'localhost');

const isLocalHost = (host: string): boolean =>
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

const getBrowserOrigin = (): string => (isBrowser ? window.location.origin : '');

const getStoredOverride = (key: string): string | undefined => {
    if (!isBrowser) return undefined;
    try {
        return localStorage.getItem(key) || undefined;
    } catch {
        return undefined;
    }
};

const normalizeUrl = (value: string | undefined, fallback: string): string => {
    const candidate = value?.trim();
    return stripTrailingSlash(candidate && candidate.length > 0 ? candidate : fallback);
};

const browserOrigin = getBrowserOrigin();
const hostName = getHostName();
const localApiFallback = 'http://localhost:8000';
const localWorkspaceFallback = 'http://localhost:3000';
const productionApiFallback = browserOrigin || localApiFallback;
const productionWorkspaceFallback = browserOrigin || localWorkspaceFallback;
const apiFallback = isLocalHost(hostName) ? localApiFallback : productionApiFallback;
const workspaceFallback = isLocalHost(hostName)
    ? localWorkspaceFallback
    : productionWorkspaceFallback;

const apiOverride = getStoredOverride('deexen_api_url');
const workspaceOverride = getStoredOverride('deexen_workspace_api_url');
const wsOverride = getStoredOverride('deexen_ws_url');

export const runtimeConfig = {
    apiUrl: normalizeUrl(apiOverride || import.meta.env.VITE_API_URL, apiFallback),
    workspaceApiUrl: normalizeUrl(
        workspaceOverride || import.meta.env.VITE_WORKSPACE_API_URL,
        workspaceFallback,
    ),
    wsBaseUrl: normalizeUrl(
        wsOverride || import.meta.env.VITE_WS_URL || workspaceOverride || import.meta.env.VITE_WORKSPACE_API_URL,
        workspaceFallback,
    ),
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
