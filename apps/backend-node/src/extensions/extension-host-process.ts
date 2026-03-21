import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { HostRequest, HostResponse, ExtensionRecord, ExtensionManifest, ExtensionStatusInfo } from './contracts';

type Disposable = { dispose: () => void };

type LoadedExtension = {
    record: ExtensionRecord;
    manifest: ExtensionManifest;
    activated: boolean;
    activationTime?: number;
    exports?: any;
    moduleContext?: { subscriptions: Disposable[] };
};

const loaded = new Map<string, LoadedExtension>();
const commandHandlers = new Map<string, (...args: any[]) => any>();
const terminalProfiles = new Map<string, { id: string; title: string; extensionId: string }>();
let terminalIdCounter = 0;

function send(msg: HostResponse) {
    if (process.send) process.send(msg);
}

// ─── Activation Event Matching ───────────────────────────────────────

function matchesActivationEvent(ext: LoadedExtension, event: string, payload?: any): boolean {
    const events = ext.manifest.activationEvents || [];

    // Wildcard: always activate
    if (events.includes('*')) return true;

    if (event === 'onStartupFinished' && events.includes('onStartupFinished')) return true;

    if (event === 'onCommand') {
        const cmd = String(payload?.command || '');
        return events.includes(`onCommand:${cmd}`);
    }

    if (event === 'onLanguage') {
        const lang = String(payload?.language || '');
        return events.includes(`onLanguage:${lang}`);
    }

    if (event === 'onFileOpen' && events.includes('onFileOpen')) return true;

    if (event === 'onDebug') {
        const debugType = String(payload?.type || '');
        if (events.includes('onDebug')) return true;
        if (debugType && events.includes(`onDebug:${debugType}`)) return true;
        return false;
    }

    if (event === 'onUri') {
        return events.includes('onUri');
    }

    if (event === 'onView') {
        const viewId = String(payload?.viewId || '');
        return events.includes(`onView:${viewId}`);
    }

    if (event === 'workspaceContains') {
        const p = String(payload?.path || '');
        return events.some((e) => e.startsWith('workspaceContains:') && p.endsWith(e.split(':')[1]));
    }

    return false;
}

// ─── Editor API (provided to extensions) ─────────────────────────────

function createEditorApi(extensionId: string) {
    return {
        commands: {
            register: (commandId: string, callback: (...args: any[]) => any) => {
                commandHandlers.set(commandId, callback);
                send({ type: 'event', name: 'commandRegistered', payload: { extensionId, commandId } });
                return {
                    dispose: () => {
                        commandHandlers.delete(commandId);
                        send({ type: 'event', name: 'commandUnregistered', payload: { extensionId, commandId } });
                    },
                };
            },
            executeCommand: async (commandId: string, ...args: any[]) => {
                const handler = commandHandlers.get(commandId);
                if (handler) return handler(...args);
                throw new Error(`Command not found: ${commandId}`);
            },
        },
        terminal: {
            create: (options?: { name?: string; shellPath?: string; shellArgs?: string[]; cwd?: string }) => {
                const id = `term-${++terminalIdCounter}`;
                send({
                    type: 'event',
                    name: 'terminalCreate',
                    payload: {
                        extensionId,
                        terminalId: id,
                        name: options?.name,
                        shellPath: options?.shellPath,
                        shellArgs: options?.shellArgs,
                        cwd: options?.cwd,
                    },
                });
                return {
                    id,
                    sendText: (text: string, addNewLine?: boolean) => {
                        send({ type: 'event', name: 'terminalSendText', payload: { terminalId: id, text, addNewLine } });
                    },
                    show: () => {
                        send({ type: 'event', name: 'terminalShow', payload: { terminalId: id } });
                    },
                    dispose: () => {
                        send({ type: 'event', name: 'terminalDispose', payload: { terminalId: id } });
                    },
                };
            },
            sendText: (text: string, addNewLine?: boolean) => {
                send({ type: 'event', name: 'terminalSendText', payload: { text, addNewLine } });
            },
        },
        window: {
            showInformationMessage: (message: string) => {
                send({ type: 'event', name: 'windowInfo', payload: { extensionId, message } });
            },
            showErrorMessage: (message: string) => {
                send({ type: 'event', name: 'windowError', payload: { extensionId, message } });
            },
            showWarningMessage: (message: string) => {
                send({ type: 'event', name: 'windowWarning', payload: { extensionId, message } });
            },
            createTerminal: (nameOrOptions?: string | { name?: string; shellPath?: string; shellArgs?: string[]; cwd?: string }, shellPath?: string, shellArgs?: string[]) => {
                const opts = typeof nameOrOptions === 'string'
                    ? { name: nameOrOptions, shellPath, shellArgs }
                    : nameOrOptions || {};
                const id = `term-${++terminalIdCounter}`;
                send({
                    type: 'event',
                    name: 'terminalCreate',
                    payload: { extensionId, terminalId: id, ...opts },
                });
                return {
                    id,
                    name: opts.name || 'Extension Terminal',
                    sendText: (text: string, addNewLine?: boolean) => {
                        send({ type: 'event', name: 'terminalSendText', payload: { terminalId: id, text, addNewLine } });
                    },
                    show: () => {
                        send({ type: 'event', name: 'terminalShow', payload: { terminalId: id } });
                    },
                    dispose: () => {
                        send({ type: 'event', name: 'terminalDispose', payload: { terminalId: id } });
                    },
                };
            },
            createOutputChannel: (name: string) => {
                return {
                    name,
                    append: (text: string) => {
                        send({ type: 'event', name: 'outputChannel', payload: { extensionId, channelName: name, text } });
                    },
                    appendLine: (text: string) => {
                        send({ type: 'event', name: 'outputChannel', payload: { extensionId, channelName: name, text: text + '\n' } });
                    },
                    clear: () => {
                        send({ type: 'event', name: 'outputChannelClear', payload: { extensionId, channelName: name } });
                    },
                    show: () => {
                        send({ type: 'event', name: 'outputChannelShow', payload: { extensionId, channelName: name } });
                    },
                    dispose: () => { /* no-op */ },
                };
            },
            registerTerminalProfileProvider: (profileId: string, provider: { provideTerminalProfile: (token?: any) => any }) => {
                terminalProfiles.set(profileId, { id: profileId, title: profileId, extensionId });
                send({ type: 'event', name: 'terminalProfileRegistered', payload: { extensionId, profileId } });
                return {
                    dispose: () => {
                        terminalProfiles.delete(profileId);
                    },
                };
            },
        },
        workspace: {
            getConfiguration: (section?: string) => {
                return {
                    get: <T>(key: string, defaultValue?: T): T | undefined => defaultValue,
                    has: (key: string): boolean => false,
                    update: async (key: string, value: any) => { /* no-op stub */ },
                };
            },
            workspaceFolders: undefined as any,
            rootPath: undefined as string | undefined,
            name: undefined as string | undefined,
        },
        env: {
            appName: 'Deexen IDE',
            appRoot: process.cwd(),
            language: 'en',
            machineId: 'deexen-host',
            uriScheme: 'deexen',
        },
    };
}

// ─── Extension Loading & Activation ──────────────────────────────────

function runExtensionMain(ext: LoadedExtension) {
    const mainRel = ext.manifest.main || 'index.js';
    const extensionRoot = fs.existsSync(path.join(ext.record.installPath, 'extension'))
        ? path.join(ext.record.installPath, 'extension')
        : ext.record.installPath;
    const mainPath = path.join(extensionRoot, mainRel);

    const code = fs.readFileSync(mainPath, 'utf8');
    const wrapper = `(function (exports, require, module, __filename, __dirname) { ${code}\n})`;

    const forbidden = new Set(['child_process', 'cluster', 'worker_threads']);
    const editorApi = createEditorApi(ext.record.id);

    const localRequire = (request: string) => {
        if (request === 'vscode' || request === 'editor') return editorApi;
        if (forbidden.has(request)) {
            throw new Error(`Module '${request}' is blocked in extension sandbox.`);
        }

        if (request.startsWith('.')) {
            const resolved = path.resolve(path.dirname(mainPath), request);
            return require(resolved);
        }

        return require(request);
    };

    const sandbox: any = {
        exports: {},
        module: { exports: {} },
        require: localRequire,
        __filename: mainPath,
        __dirname: path.dirname(mainPath),
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Buffer,
        process: {
            env: {},
            platform: process.platform,
            versions: process.versions,
            cwd: () => process.cwd(),
        },
    };

    const script = new vm.Script(wrapper, { filename: mainPath });
    const context = vm.createContext(sandbox);
    const fn = script.runInContext(context);
    fn(sandbox.exports, sandbox.require, sandbox.module, sandbox.__filename, sandbox.__dirname);

    return sandbox.module.exports;
}

async function activateExtension(ext: LoadedExtension, reason: string) {
    if (ext.activated) return;

    const startTime = Date.now();
    const mod = runExtensionMain(ext);
    const ctx = { subscriptions: [] as Disposable[] };
    if (typeof mod.activate === 'function') {
        await Promise.resolve(mod.activate(ctx));
    }

    ext.moduleContext = ctx;
    ext.exports = mod;
    ext.activated = true;
    ext.activationTime = Date.now() - startTime;

    send({ type: 'event', name: 'extensionActivated', payload: { extensionId: ext.record.id, reason, activationTime: ext.activationTime } });
}

async function deactivateAll() {
    for (const ext of loaded.values()) {
        if (!ext.activated) continue;
        try {
            if (typeof ext.exports?.deactivate === 'function') {
                await Promise.resolve(ext.exports.deactivate());
            }
            for (const d of ext.moduleContext?.subscriptions || []) {
                try { d.dispose(); } catch { }
            }
        } catch { }
        ext.activated = false;
    }
}

function getExtensionStatus(): ExtensionStatusInfo[] {
    const statuses: ExtensionStatusInfo[] = [];
    for (const ext of loaded.values()) {
        const extCommands = Array.from(commandHandlers.keys());
        statuses.push({
            id: ext.record.id,
            name: ext.manifest.name,
            publisher: ext.manifest.publisher,
            version: ext.manifest.version,
            activated: ext.activated,
            activationTime: ext.activationTime,
            commandCount: extCommands.length,
        });
    }
    return statuses;
}

// ─── Message Handler ─────────────────────────────────────────────────

async function handleRequest(msg: HostRequest) {
    try {
        if (msg.type === 'loadExtensions') {
            const records = (msg.payload?.extensions || []) as ExtensionRecord[];
            loaded.clear();
            commandHandlers.clear();

            for (const record of records) {
                loaded.set(record.id, {
                    record,
                    manifest: record.manifest,
                    activated: false,
                });
            }

            send({ requestId: msg.requestId, type: 'response', name: 'loadExtensions', ok: true, payload: { count: loaded.size } });
            return;
        }

        if (msg.type === 'activateEvent') {
            const event = String(msg.payload?.event || '');
            const payload = msg.payload?.payload;

            const targets = Array.from(loaded.values()).filter((e) => matchesActivationEvent(e, event, payload));
            await Promise.all(targets.map((t) => activateExtension(t, event)));

            send({ requestId: msg.requestId, type: 'response', name: 'activateEvent', ok: true, payload: { activated: targets.length } });
            return;
        }

        if (msg.type === 'executeCommand') {
            const command = String(msg.payload?.command || '');

            await Promise.all(Array.from(loaded.values())
                .filter((e) => matchesActivationEvent(e, 'onCommand', { command }))
                .map((e) => activateExtension(e, `onCommand:${command}`)));

            const handler = commandHandlers.get(command);
            const result = handler ? await Promise.resolve(handler(...(msg.payload?.args || []))) : undefined;

            send({ requestId: msg.requestId, type: 'response', name: 'executeCommand', ok: true, payload: { found: !!handler, result } });
            return;
        }

        if (msg.type === 'deactivateAll') {
            await deactivateAll();
            send({ requestId: msg.requestId, type: 'response', name: 'deactivateAll', ok: true });
            return;
        }

        if (msg.type === 'getStatus') {
            const statuses = getExtensionStatus();
            send({ requestId: msg.requestId, type: 'response', name: 'getStatus', ok: true, payload: { extensions: statuses } });
            return;
        }

        send({ requestId: msg.requestId, type: 'response', name: msg.type, ok: false, error: 'Unknown request' });
    } catch (error: any) {
        send({ requestId: msg.requestId, type: 'response', name: msg.type, ok: false, error: error?.message || 'Host error' });
    }
}

process.on('message', (raw: HostRequest) => {
    if (!raw || !raw.type) return;
    handleRequest(raw);
});

send({ type: 'event', name: 'hostReady', payload: { pid: process.pid } });

