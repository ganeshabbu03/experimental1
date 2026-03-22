import { usePluginStore } from '@/stores/usePluginStore';
import { useToastStore } from '@/stores/useToastStore';
import { useFileStore } from '@/stores/useFileStore';
import { apiClient } from '@/services/apiClient';

/**
 * PluginHostService
 * -----------------
 * Manages the Web Worker that runs Deexen Extensions.
 * Parses the installed extensions, looks for 'browser' entrypoints in package.json,
 * downloads them via the backend proxy, and sends them to the worker for execution.
 */
export class PluginHostService {
    private static instance: PluginHostService;
    private worker: Worker | null = null;
    private initialized = false;
    private unsubscribeFileStore: (() => void) | null = null;

    private constructor() { }

    public static getInstance(): PluginHostService {
        if (!PluginHostService.instance) {
            PluginHostService.instance = new PluginHostService();
        }
        return PluginHostService.instance;
    }

    /** Initialize the Web Worker and load active plugins */
    public async init() {
        if (this.initialized) return;
        this.initialized = true;

        console.log('[PluginHost] Initializing Extension Host...');

        // Spawn the worker. Vite handles this relative URL magic.
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (err) => {
            console.error('[PluginHost] Worker Error:', err);
        };

        // Subscribe to real-time changes from Deexen's IDE state
        this.unsubscribeFileStore = useFileStore.subscribe((state) => {
            if (this.worker) {
                this.worker.postMessage({
                    type: 'workspace-state-sync',
                    payload: {
                        projectName: state.projectName,
                        activeFileId: state.activeFileId,
                        files: state.files
                    }
                });
            }
        });

        // Push initial state immediately
        const initialState = useFileStore.getState();
        this.worker.postMessage({
            type: 'workspace-state-sync',
            payload: {
                projectName: initialState.projectName,
                activeFileId: initialState.activeFileId,
                files: initialState.files
            }
        });

        await this.loadInstalledPlugins();
    }

    /** Handle RPC calls coming back from the extension worker. */
    private handleWorkerMessage(e: MessageEvent) {
        if (!e.data || !e.data.type) return;

        const { type, payload } = e.data;
        // console.log(`[PluginHost] Received message: ${type}`, payload);

        // Map vscode API calls back to Deexen features
        if (type === 'vscode.window.showInformationMessage') {
            useToastStore.getState().addToast(`Extension: ${payload}`, 'info', 5000);
        } else if (type === 'vscode.window.showErrorMessage') {
            useToastStore.getState().addToast(`Extension Error: ${payload}`, 'error', 5000);
        } else if (type === 'plugin-activated') {
            console.log(`[PluginHost] Successfully activated plugin: ${payload}`);
        } else if (type === 'plugin-activated-no-exports') {
            console.log(`[PluginHost] Plugin ${payload} loaded successfully but exported no generic activate function.`);
        } else if (type === 'plugin-error') {
            const { id, error } = payload;
            console.error(`[PluginHost] Failed to activate plugin ${id}:`, error);
            // Optionally notify user
        }
    }

    /** Fetch package.json for an extension to find its browser entrypoint */
    private async getPluginPackageJson(publisher: string, name: string, version: string): Promise<any> {
        return apiClient.get(`/plugins/package-json/${publisher}/${name}/${version}`);
    }

    /** Fetch the raw JS file from the backend */
    private async getPluginFile(publisher: string, name: string, version: string, path: string): Promise<string> {
        // apiClient.get automatically parses JSON, but we want raw text here if it's JS.
        // using standard fetch since it returns raw text.
        const token = localStorage.getItem('supabase.auth.token'); // Replace if Deexen uses a different auth header logic
        let url = `/api/plugins/file/${publisher}/${name}/${version}/${path}`; // Assuming Vite proxy maps /api to backend 8000

        // Use full URL if the frontend proxy isn't configured for /api/plugins/file
        // Actually we can just use the standard backend URL.
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        url = `${backendUrl}/plugins/file/${publisher}/${name}/${version}/${path}`;

        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching ${path}`);
        }
        return response.text();
    }

    /** Boot up all installed extensions on workspace load */
    private async loadInstalledPlugins() {
        const plugins = usePluginStore.getState().installedPlugins;

        for (const plugin of plugins) {
            try {
                // 1. Fetch package.json
                const pkg = await this.getPluginPackageJson(plugin.publisher, plugin.extension, plugin.version);

                // 2. Identify the entry point for the browser
                // In VS Code extensions, "browser" specifies the web-compatible entry point
                const entryPoint = pkg.browser;

                if (!entryPoint) {
                    console.log(`[PluginHost] Skipping ${plugin.displayName}: No 'browser' entrypoint in package.json.`);
                    continue;
                }

                // Clean the path (e.g. "./dist/web/extension.js" -> "dist/web/extension.js")
                const cleanPath = entryPoint.startsWith('./') ? entryPoint.slice(2) : entryPoint;

                // 3. Fetch the raw javascript file
                const jsCode = await this.getPluginFile(plugin.publisher, plugin.extension, plugin.version, cleanPath);

                console.log(`[PluginHost] Sending ${plugin.displayName} to worker for execution.`);

                // 4. Send to worker
                this.worker?.postMessage({
                    type: 'init-plugin',
                    payload: {
                        id: `${plugin.publisher}.${plugin.extension}`,
                        code: jsCode
                    }
                });

            } catch (err) {
                console.error(`[PluginHost] Failed to initialize plugin ${plugin.displayName}:`, err);
            }
        }
    }

    /** Close the worker gracefully */
    public shutdown() {
        if (this.unsubscribeFileStore) {
            this.unsubscribeFileStore();
            this.unsubscribeFileStore = null;
        }
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.initialized = false;
        console.log('[PluginHost] Extension Host shut down.');
    }
}
