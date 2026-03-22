/**
 * worker.ts
 * ---------
 * The isolated Web Worker environment that runs user-installed Extension code.
 * This runs in a background thread with no access to the main DOM.
 * It listens for messages from PluginHostService to initialize plugins.
 */

// Simple EventEmitter polyfill to mimic vscode.Event behavior
class EventEmitter {
    private listeners: Function[] = [];
    event = (listener: Function) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };
    fire = (data: any) => {
        this.listeners.forEach(l => l(data));
    };
}

// Replica state synchronized from Deexen's main thread
const stateReplica = {
    projectName: "Deexen Workspace",
    activeFilePath: null as string | null,
    textDocuments: [] as any[]
};

// Event emitters mapping to vscode API
const onDidChangeTextDocumentEmitter = new EventEmitter();
const onDidOpenTextDocumentEmitter = new EventEmitter();

// A mock "vscode" API object that extensions natively expect.
const vscode = {
    window: {
        showInformationMessage: (message: string) => {
            self.postMessage({ type: 'vscode.window.showInformationMessage', payload: message });
            return Promise.resolve();
        },
        showErrorMessage: (message: string) => {
            self.postMessage({ type: 'vscode.window.showErrorMessage', payload: message });
            return Promise.resolve();
        },
        get activeTextEditor() {
            if (!stateReplica.activeFilePath) return undefined;
            const doc = stateReplica.textDocuments.find(d => d.uri === stateReplica.activeFilePath);
            if (!doc) return undefined;
            return { document: doc };
        }
    },
    workspace: {
        get name() { return stateReplica.projectName; },
        get textDocuments() { return stateReplica.textDocuments; },
        onDidChangeTextDocument: onDidChangeTextDocumentEmitter.event,
        onDidOpenTextDocument: onDidOpenTextDocumentEmitter.event,
        fs: {
            readFile: async (_uri: any) => {
                // Return generic for now, ideally request it async via postMessage
                return new Uint8Array();
            }
        }
    }
    // (We will expand this mock API over time as we support more of VS Code's surface area)
};

// Expose the mock API globally so extension scripts can access it.
// Many extensions use require('vscode') or expect a global vscode object in the browser.
(self as any).vscode = vscode;

// A module loader override to inject our `vscode` mock if the extension tries to require it.
const moduleMap: Record<string, any> = {
    vscode: vscode,
};

(self as any).require = (moduleName: string) => {
    if (moduleMap[moduleName]) {
        return moduleMap[moduleName];
    }
    throw new Error(`Module ${moduleName} not found in Deexen Web Worker sandbox.`);
};

// Polyfills for basic browser expectations of standard commonjs modules
(self as any).module = { exports: {} };
(self as any).exports = (self as any).module.exports;

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    // Handle real-time state sync from PluginHostService
    if (type === 'workspace-state-sync') {
        const { projectName, activeFileId, files } = payload;
        stateReplica.projectName = projectName;
        stateReplica.activeFilePath = activeFileId; // Simple mapping id -> path

        // Very basic mapping of files to textDocuments
        stateReplica.textDocuments = files.map((f: any) => ({
            uri: f.id,
            fileName: f.name,
            isUntitled: false,
            languageId: 'plaintext',
            version: 1,
            getText: () => f.content || ''
        }));

        // Fire event (In a real scenario, we'd delta-check to see which file opened/changed)
        // For now, fire open for the active file id
        if (activeFileId) {
            const doc = stateReplica.textDocuments.find(d => d.uri === activeFileId);
            if (doc) {
                onDidOpenTextDocumentEmitter.fire(doc);
            }
        }
        return;
    }

    if (type === 'init-plugin') {
        const { id, code } = payload;
        try {
            // Evaluate the extension script text dynamically safely within this worker scope
            const evaluateCode = new Function('require', 'module', 'exports', 'vscode', code);
            evaluateCode((self as any).require, (self as any).module, (self as any).exports, vscode);

            // Attempt to call `activate` if the extension exported it
            const extensionExports = (self as any).module.exports;
            if (extensionExports && typeof extensionExports.activate === 'function') {
                await extensionExports.activate({
                    subscriptions: [],
                    extensionUri: id
                });
                self.postMessage({ type: 'plugin-activated', payload: id });
            } else {
                self.postMessage({ type: 'plugin-activated-no-exports', payload: id });
            }
        } catch (error: any) {
            console.error(`Error activating plugin ${id}:`, error);
            self.postMessage({ type: 'plugin-error', payload: { id, error: error.message } });
        }
    }
};

console.log("Deexen Plugin Worker Initialized.");
