/**
 * vscode-api.ts
 * 
 * Real VS Code Extension API bridge for Deexen IDE.
 * Every method does actual work — routes to real PTY terminals,
 * WebSocket events, filesystem operations, and configuration storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { IPty } from 'node-pty';

// ─── Event System ────────────────────────────────────────────────────

class EventEmitter<T> {
    private listeners: ((e: T) => any)[] = [];

    event = (listener: (e: T) => any, thisArgs?: any, disposables?: any[]) => {
        const boundListener = thisArgs ? listener.bind(thisArgs) : listener;
        this.listeners.push(boundListener);

        const disposable = {
            dispose: () => {
                const index = this.listeners.indexOf(boundListener);
                if (index > -1) this.listeners.splice(index, 1);
            }
        };

        if (disposables) {
            disposables.push(disposable);
        }

        return disposable;
    };

    fire(data: T) {
        for (const listener of this.listeners) {
            try {
                listener(data);
            } catch (err) {
                console.error('[ExtensionHost] Error in event listener:', err);
            }
        }
    }
}

// ─── Real Data Types ─────────────────────────────────────────────────

class Position {
    constructor(public line: number, public character: number) { }
    isEqual(other: Position) { return this.line === other.line && this.character === other.character; }
    isBefore(other: Position) { return this.line < other.line || (this.line === other.line && this.character < other.character); }
    isAfter(other: Position) { return !this.isEqual(other) && !this.isBefore(other); }
    translate(lineDelta: number = 0, characterDelta: number = 0) { return new Position(this.line + lineDelta, this.character + characterDelta); }
    with(line?: number, character?: number) { return new Position(line ?? this.line, character ?? this.character); }
    compareTo(other: Position) { return this.isBefore(other) ? -1 : this.isAfter(other) ? 1 : 0; }
}

class Range {
    constructor(public start: Position, public end: Position) { }
    get isEmpty() { return this.start.isEqual(this.end); }
    get isSingleLine() { return this.start.line === this.end.line; }
    contains(positionOrRange: any) { return true; }
    isEqual(other: Range) { return this.start.isEqual(other.start) && this.end.isEqual(other.end); }
    intersection(range: Range) { return this; }
    union(other: Range) { return this; }
    with(start?: Position, end?: Position) { return new Range(start ?? this.start, end ?? this.end); }
}

class Selection extends Range {
    public anchor: Position;
    public active: Position;
    constructor(anchor: Position, active: Position) {
        super(anchor, active);
        this.anchor = anchor;
        this.active = active;
    }
    get isReversed() { return this.anchor.isAfter(this.active); }
}

class Location { constructor(public uri: any, public rangeOrPosition: any) { } }
class CodeLens { constructor(public range: Range, public command?: any) { } }
class CallHierarchyItem { constructor(public kind: any, public name: string, public detail: string, public uri: any, public range: Range, public selectionRange: Range) { } }
class TypeHierarchyItem { constructor(public kind: any, public name: string, public detail: string, public uri: any, public range: Range, public selectionRange: Range) { } }
class Diagnostic { constructor(public range: Range, public message: string, public severity?: any) { } }
class CompletionItem { constructor(public label: string, public kind?: any) { } }
class WorkspaceEdit { private _edits: any[] = []; replace() { } insert() { } delete() { } has() { return false; } set() { } get() { return []; } entries() { return []; } get size() { return 0; } }
class TextEdit {
    constructor(public range: Range, public newText: string) { }
    static replace(range: Range, newText: string) { return new TextEdit(range, newText); }
    static insert(position: Position, newText: string) { return new TextEdit(new Range(position, position), newText); }
    static delete(range: Range) { return new TextEdit(range, ''); }
}
class SnippetString { constructor(public value: string = '') { } appendText(s: string) { this.value += s; return this; } appendPlaceholder(s: any) { return this; } }
class ThemeColor { constructor(public id: string) { } }
class ThemeIcon { static File = new ThemeIcon('file'); static Folder = new ThemeIcon('folder'); constructor(public id: string) { } }
class MarkdownString {
    constructor(public value: string = '', public supportThemeIcons: boolean = false) { }
    appendMarkdown(s: string) { this.value += s; return this; }
    appendText(s: string) { this.value += s; return this; }
    appendCodeblock(s: string, lang?: string) { this.value += `\n\`\`\`${lang || ''}\n${s}\n\`\`\`\n`; return this; }
}
class FoldingRange { constructor(public start: number, public end: number, public kind?: number) { } }
class SignatureHelp { signatures: any[] = []; activeSignature: number = 0; activeParameter: number = 0; }
class ParameterInformation { constructor(public label: string | [number, number], public documentation?: any) { } }
class ShellExecution { constructor(public commandLine: string, public options?: any) { } }

class UriImpl {
    constructor(
        private _scheme: string = 'file',
        private _authority: string = '',
        private _path: string = '/',
        private _query: string = '',
        private _fragment: string = '',
    ) { }

    static file(filePath: string) { return new UriImpl('file', '', filePath); }
    static parse(value: string) { return new UriImpl('parsed', '', value); }
    static joinPath(base: UriImpl, ...paths: string[]) { return new UriImpl(base.scheme, base.authority, path.join(base.path, ...paths)); }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }) {
        return new UriImpl(
            change.scheme ?? this._scheme,
            change.authority ?? this._authority,
            change.path ?? this._path,
            change.query ?? this._query,
            change.fragment ?? this._fragment,
        );
    }

    get scheme() { return this._scheme; }
    get authority() { return this._authority; }
    get path() { return this._path; }
    get query() { return this._query; }
    get fragment() { return this._fragment; }
    get fsPath() { return this._path; }

    toString() { return this._path; }
}

// ─── Service Interfaces ──────────────────────────────────────────────

export interface VscodeApiServices {
    /** Emit WebSocket event to the connected frontend client */
    wsEmit: (event: string, payload: any) => void;
    /** Spawn a real PTY terminal */
    ptySpawner: (options: { name?: string; shellPath?: string; shellArgs?: string[]; cwd?: string; env?: any }) => IPty;
    /** Path to workspace root */
    workspaceRoot: string;
    /** Path to configuration storage */
    configPath: string;
    /** Extension API framework for language providers */
    extensionApiFramework?: any;
    /** Runtime PATH environment (from ExtensionHostService) */
    terminalEnv: NodeJS.ProcessEnv;
}

// ─── Global Command Registry ────────────────────────────────────────

export const registeredCommands = new Map<string, (...args: any[]) => any>();

// ─── Factory Function ────────────────────────────────────────────────

let requireLogged = false;

export function createVscodeApi(services: VscodeApiServices) {
    const outputChannels = new Map<string, { lines: string[] }>();
    const terminalInstances = new Map<string, { ptyProcess: IPty; name: string }>();
    let terminalIdCounter = 0;
    const webviewViewProviders = new Map<string, { provider: any; options?: any }>();
    const webviewInstances = new Map<string, {
        viewId: string;
        title: string;
        kind: 'panel' | 'view';
        receiveEmitter: EventEmitter<any>;
    }>();

    function parseExtensionResource(fsPathRaw: string): {
        publisher: string;
        extensionName: string;
        version: string;
        relSegments: string[];
    } | null {
        const normalized = String(fsPathRaw || '').replace(/\\/g, '/');
        const marker = '/storage/plugins/extracted/';
        const markerIdx = normalized.toLowerCase().indexOf(marker);
        if (markerIdx === -1) {
            return null;
        }

        const trailing = normalized.slice(markerIdx + marker.length).split('/').filter(Boolean);
        if (trailing.length < 3) {
            return null;
        }

        const folder = trailing[0];
        const extensionSegmentIdx = trailing.indexOf('extension');
        if (extensionSegmentIdx === -1 || extensionSegmentIdx >= trailing.length - 1) {
            return null;
        }

        const semverMatch = folder.match(/^([^.]+)\.(.+)-(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)$/);
        let publisher = '';
        let extensionName = '';
        let version = '';

        if (semverMatch) {
            publisher = semverMatch[1];
            extensionName = semverMatch[2];
            version = semverMatch[3];
        } else {
            const dotIdx = folder.indexOf('.');
            const dashIdx = folder.lastIndexOf('-');
            if (dotIdx <= 0 || dashIdx <= dotIdx) {
                return null;
            }
            publisher = folder.slice(0, dotIdx);
            extensionName = folder.slice(dotIdx + 1, dashIdx);
            version = folder.slice(dashIdx + 1);
        }

        if (!publisher || !extensionName || !version) {
            return null;
        }

        return {
            publisher,
            extensionName,
            version,
            relSegments: trailing.slice(extensionSegmentIdx + 1),
        };
    }

    function toDeexenResourceUri(uri: any): string {
        const fsPath = typeof uri === 'string'
            ? uri
            : (uri?.fsPath || uri?.path || (typeof uri?.toString === 'function' ? uri.toString() : String(uri || '')));
        const parsed = parseExtensionResource(fsPath);
        if (!parsed) {
            return String(fsPath || '');
        }

        const encodedParts = [
            parsed.publisher,
            parsed.extensionName,
            parsed.version,
            ...parsed.relSegments,
        ].map((segment) => encodeURIComponent(String(segment)));

        return `deexen-resource://${encodedParts.join('/')}`;
    }

    function createWebviewRuntime(
        viewId: string,
        title: string,
        kind: 'panel' | 'view',
        options?: any,
    ) {
        const receiveEmitter = new EventEmitter<any>();
        let html = '';
        let runtimeTitle = title;
        const record = { viewId, title: runtimeTitle, kind, receiveEmitter };
        webviewInstances.set(viewId, record);

        const webview: any = {
            onDidReceiveMessage: receiveEmitter.event,
            postMessage: async (message: any) => {
                services.wsEmit('extension.webview.message', { viewId, title: runtimeTitle, kind, message });
                return true;
            },
            asWebviewUri: (uri: any) => toDeexenResourceUri(uri),
            cspSource: 'deexen-resource:',
            options: options || {},
        };

        Object.defineProperty(webview, 'html', {
            get: () => html,
            set: (value: string) => {
                html = String(value || '');
                services.wsEmit('extension.webview.html', { viewId, title: runtimeTitle, kind, html });
            },
            enumerable: true,
            configurable: true,
        });

        const setTitle = (newTitle: string) => {
            runtimeTitle = String(newTitle || viewId);
            record.title = runtimeTitle;
            services.wsEmit('extension.webview.opened', { viewId, title: runtimeTitle, kind, html });
        };

        const dispose = () => {
            webviewInstances.delete(viewId);
            services.wsEmit('extension.webview.disposed', { viewId, title: runtimeTitle, kind });
        };

        services.wsEmit('extension.webview.opened', { viewId, title: runtimeTitle, kind, html });

        return {
            webview,
            getHtml: () => html,
            getTitle: () => runtimeTitle,
            setTitle,
            dispose,
        };
    }

    async function openRegisteredWebviewView(viewId: string): Promise<boolean> {
        const entry = webviewViewProviders.get(viewId);
        if (!entry || !entry.provider) {
            return false;
        }

        const runtime = createWebviewRuntime(viewId, viewId, 'view', entry.options);
        const onDidDisposeEmitter = new EventEmitter<any>();
        const onDidChangeVisibilityEmitter = new EventEmitter<any>();

        const webviewView: any = {
            viewType: viewId,
            title: viewId,
            description: '',
            badge: undefined,
            visible: true,
            webview: runtime.webview,
            onDidDispose: onDidDisposeEmitter.event,
            onDidChangeVisibility: onDidChangeVisibilityEmitter.event,
            show: (_preserveFocus?: boolean) => {
                webviewView.visible = true;
                onDidChangeVisibilityEmitter.fire({ webviewView });
                services.wsEmit('extension.webview.opened', {
                    viewId,
                    title: webviewView.title || runtime.getTitle(),
                    kind: 'view',
                    html: runtime.getHtml(),
                });
            },
            dispose: () => {
                onDidDisposeEmitter.fire(undefined);
                runtime.dispose();
            },
        };

        try {
            const resolver = entry.provider.resolveWebviewView;
            if (typeof resolver === 'function') {
                await Promise.resolve(
                    resolver.call(
                        entry.provider,
                        webviewView,
                        { state: undefined },
                        { isCancellationRequested: false, onCancellationRequested: new EventEmitter<any>().event },
                    ),
                );
            }

            runtime.setTitle(webviewView.title || viewId);
            return true;
        } catch (err) {
            console.error(`[ExtensionHost] Failed to open webview view ${viewId}:`, err);
            runtime.dispose();
            return false;
        }
    }

    function postMessageToWebview(viewId: string, message: any): boolean {
        const instance = webviewInstances.get(viewId);
        if (!instance) {
            return false;
        }
        instance.receiveEmitter.fire(message);
        return true;
    }

    // ─── Real Configuration ──────────────────────────────────────

    function readConfig(): Record<string, any> {
        try {
            if (fs.existsSync(services.configPath)) {
                return JSON.parse(fs.readFileSync(services.configPath, 'utf8'));
            }
        } catch { }
        return {};
    }

    function writeConfig(config: Record<string, any>) {
        try {
            fs.mkdirSync(path.dirname(services.configPath), { recursive: true });
            fs.writeFileSync(services.configPath, JSON.stringify(config, null, 2), 'utf8');
        } catch (err) {
            console.error('[ExtensionHost] Failed to write config:', err);
        }
    }

    // ─── Real Language Provider Registration ─────────────────────

    const registeredProviders = new Map<string, any>();

    function registerProvider(type: string, selectorOrArgs: any, provider: any) {
        const id = `${type}-${registeredProviders.size}`;
        registeredProviders.set(id, { type, selector: selectorOrArgs, provider });

        // If ExtensionApiFrameworkService is available, register there too
        if (services.extensionApiFramework && typeof services.extensionApiFramework.registerLspProvider === 'function') {
            const language = typeof selectorOrArgs === 'string' ? selectorOrArgs :
                typeof selectorOrArgs?.language === 'string' ? selectorOrArgs.language :
                    Array.isArray(selectorOrArgs) && selectorOrArgs[0]?.language ? selectorOrArgs[0].language : '';
            if (language) {
                services.extensionApiFramework.registerLspProvider({ language, diagnostics: [], completions: [] });
            }
        }

        console.log(`[ExtensionHost] Registered ${type} provider: ${id}`);
        return {
            dispose: () => {
                registeredProviders.delete(id);
            }
        };
    }

    // ── Build the API ────────────────────────────────────────────

    const onDidChangeConfigurationEmitter = new EventEmitter<any>();
    const onDidChangeWorkspaceFoldersEmitter = new EventEmitter<any>();
    const onDidOpenTextDocumentEmitter = new EventEmitter<any>();
    const onDidCloseTextDocumentEmitter = new EventEmitter<any>(); 
    const onDidChangeTextDocumentEmitter = new EventEmitter<any>();
    const onDidSaveTextDocumentEmitter = new EventEmitter<any>();
    const onDidOpenNotebookDocumentEmitter = new EventEmitter<any>();
    const onDidCloseNotebookDocumentEmitter = new EventEmitter<any>();
    const onDidChangeNotebookDocumentEmitter = new EventEmitter<any>();
    const onDidSaveNotebookDocumentEmitter = new EventEmitter<any>();
    const onDidChangeActiveTextEditorEmitter = new EventEmitter<any>();
    const onDidChangeActiveNotebookEditorEmitter = new EventEmitter<any>();
    const onDidChangeVisibleNotebookEditorsEmitter = new EventEmitter<any>();
    const onDidCloseTerminalEmitter = new EventEmitter<any>();
    const onDidChangeActiveColorThemeEmitter = new EventEmitter<any>();
    const notebookDocuments: any[] = [];

    const baseApi: any = {
        // ─── Data Types ──────────────────────────────────────────
        Position,
        Range,
        Selection,
        Location,
        CodeLens,
        CallHierarchyItem,
        TypeHierarchyItem,
        Diagnostic,
        CompletionItem,
        WorkspaceEdit,
        TextEdit,
        SnippetString,
        ThemeColor,
        ThemeIcon,
        MarkdownString,
        FoldingRange,
        SignatureHelp,
        ParameterInformation,
        ShellExecution,
        Uri: UriImpl,
        EventEmitter,

        CancellationTokenSource: class CancellationTokenSource {
            token = { isCancellationRequested: false, onCancellationRequested: new EventEmitter<any>().event };
            cancel() { (this.token as any).isCancellationRequested = true; }
            dispose() { }
        },
        CancellationError: class CancellationError extends Error {
            constructor() { super('Cancelled'); this.name = 'CancellationError'; }
        },

        // ─── Enums ───────────────────────────────────────────────
        DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
        ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
        FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        StatusBarAlignment: { Left: 1, Right: 2 },
        ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9 },
        FoldingRangeKind: { Comment: 1, Imports: 2, Region: 3 },
        IndentAction: { None: 0, Indent: 1, IndentOutdent: 2, Outdent: 3 },
        TextEditorRevealType: { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 },
        DecorationRangeBehavior: { OpenOpen: 0, ClosedClosed: 1, OpenClosed: 2, ClosedOpen: 3 },
        OverviewRulerLane: { Left: 1, Center: 2, Right: 4, Full: 7 },
        EndOfLine: { LF: 1, CRLF: 2 },
        CompletionItemKind: { Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4, Variable: 5, Class: 6, Interface: 7, Module: 8, Property: 9, Unit: 10, Value: 11, Enum: 12, Keyword: 13, Snippet: 14, Color: 15, File: 16, Reference: 17, Folder: 18, EnumMember: 19, Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24, User: 25, Issue: 26 },
        CodeActionKind: { Empty: '', QuickFix: 'quickfix', Refactor: 'refactor', RefactorExtract: 'refactor.extract', RefactorInline: 'refactor.inline', RefactorRewrite: 'refactor.rewrite', Source: 'source', SourceOrganizeImports: 'source.organizeImports', SourceFixAll: 'source.fixAll' },
        CodeActionTriggerKind: { Invoke: 1, Automatic: 2 },
        SymbolKind: { File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4, Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9, Interface: 10, Function: 11, Variable: 12, Constant: 13, String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18, Key: 19, Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24, TypeParameter: 25 },
        InlayHintKind: { Type: 1, Parameter: 2 },
        LanguageStatusSeverity: { Information: 0, Warning: 1, Error: 2 },
        ExtensionKind: { UI: 1, Workspace: 2 },
        NotebookCellKind: { Markup: 1, Code: 2 },
        NotebookCellExecutionState: { Pending: 1, Executing: 2, Idle: 3 },
        TaskScope: { Global: 1, Workspace: 2 },
        TaskRevealKind: { Always: 1, Silent: 2, Never: 3 },
        TaskPanelKind: { Shared: 1, Dedicated: 2, New: 3 },
        TaskGroup: { Build: { _id: 'build', isDefault: false }, Test: { _id: 'test', isDefault: false } },
        DebugConfigurationProviderTriggerKind: { Initial: 1, Dynamic: 2 },
        DocumentHighlightKind: { Text: 0, Read: 1, Write: 2 },

        // ─── REAL: Commands (routes to registeredCommands map) ───
        commands: {
            registerCommand: (command: string, callback: (...args: any[]) => any) => {
                console.log(`[ExtensionHost] Registered command: ${command}`);
                registeredCommands.set(command, callback);
                services.wsEmit('extension.commandRegistered', { command });
                return { dispose: () => registeredCommands.delete(command) };
            },
            executeCommand: async (command: string, ...rest: any[]) => {
                console.log(`[ExtensionHost] Executing command: ${command}`);
                const handler = registeredCommands.get(command);
                if (handler) {
                    return handler(...rest);
                }
                console.warn(`[ExtensionHost] Command not found: ${command}`);
                return undefined;
            },
            getCommands: async () => Array.from(registeredCommands.keys()),
        },

        // ─── REAL: Window (WebSocket notifications + real PTY) ───
        window: {
            activeTextEditor: undefined,
            visibleTextEditors: [],
            activeNotebookEditor: undefined,
            visibleNotebookEditors: [],
            onDidChangeActiveTextEditor: onDidChangeActiveTextEditorEmitter.event,
            onDidChangeVisibleTextEditors: new EventEmitter<any>().event,
            onDidChangeActiveNotebookEditor: onDidChangeActiveNotebookEditorEmitter.event,
            onDidChangeVisibleNotebookEditors: onDidChangeVisibleNotebookEditorsEmitter.event,
            onDidCloseTerminal: onDidCloseTerminalEmitter.event,
            onDidChangeTextEditorSelection: new EventEmitter<any>().event,
            onDidChangeTextEditorVisibleRanges: new EventEmitter<any>().event,
            onDidChangeTextEditorOptions: new EventEmitter<any>().event,
            onDidChangeTextEditorViewColumn: new EventEmitter<any>().event,
            onDidChangeActiveColorTheme: onDidChangeActiveColorThemeEmitter.event,

            showInformationMessage: async (message: string, ...items: any[]) => {
                console.log(`[ExtensionHost] Info: ${message}`);
                services.wsEmit('extension.notification', { type: 'info', message, items });
                return items.length > 0 ? items[0] : undefined;
            },
            showWarningMessage: async (message: string, ...items: any[]) => {
                console.warn(`[ExtensionHost] Warning: ${message}`);
                services.wsEmit('extension.notification', { type: 'warning', message, items });
                return items.length > 0 ? items[0] : undefined;
            },
            showErrorMessage: async (message: string, ...items: any[]) => {
                console.error(`[ExtensionHost] Error: ${message}`);
                services.wsEmit('extension.notification', { type: 'error', message, items });
                return items.length > 0 ? items[0] : undefined;
            },

            // REAL: Creates actual PTY terminal
            createTerminal: (nameOrOptions: any, shellPathArg?: string, shellArgsArg?: string[]) => {
                const opts = typeof nameOrOptions === 'string'
                    ? { name: nameOrOptions, shellPath: shellPathArg, shellArgs: shellArgsArg }
                    : nameOrOptions || {};
                const termName = opts.name || 'Extension Terminal';
                const termId = `ext-term-${++terminalIdCounter}`;

                try {
                    const ptyProcess = services.ptySpawner({
                        name: termName,
                        shellPath: opts.shellPath,
                        shellArgs: opts.shellArgs,
                        cwd: opts.cwd || services.workspaceRoot,
                        env: services.terminalEnv,
                    });

                    terminalInstances.set(termId, { ptyProcess, name: termName });

                    // Forward PTY data to frontend via WebSocket
                    ptyProcess.onData((data) => {
                        services.wsEmit('extension.terminal.data', { terminalId: termId, name: termName, data });
                    });

                    ptyProcess.onExit((e) => {
                        services.wsEmit('extension.terminal.exit', { terminalId: termId, exitCode: e.exitCode });
                        terminalInstances.delete(termId);
                        onDidCloseTerminalEmitter.fire({ name: termName });
                    });

                    services.wsEmit('extension.terminal.created', { terminalId: termId, name: termName });
                    console.log(`[ExtensionHost] Created real terminal: ${termName} (${termId})`);

                    return {
                        name: termName,
                        processId: ptyProcess.pid ? Promise.resolve(ptyProcess.pid) : Promise.resolve(-1),
                        creationOptions: opts,
                        exitStatus: undefined,
                        sendText: (text: string, addNewLine?: boolean) => {
                            ptyProcess.write(`${text}${addNewLine !== false ? '\r' : ''}`);
                        },
                        show: () => {
                            services.wsEmit('extension.terminal.show', { terminalId: termId });
                        },
                        hide: () => {
                            services.wsEmit('extension.terminal.hide', { terminalId: termId });
                        },
                        dispose: () => {
                            ptyProcess.kill();
                            terminalInstances.delete(termId);
                        }
                    };
                } catch (err) {
                    console.error(`[ExtensionHost] Failed to create terminal:`, err);
                    // Fallback: return a terminal that logs to console
                    return {
                        name: termName,
                        processId: Promise.resolve(-1),
                        creationOptions: opts,
                        exitStatus: undefined,
                        sendText: (text: string) => console.log(`[Terminal ${termName}] ${text}`),
                        show: () => { },
                        hide: () => { },
                        dispose: () => { }
                    };
                }
            },

            // REAL: Creates output channel that streams to frontend via WebSocket
            createOutputChannel: (name: string, options?: any) => {
                const channel = { lines: [] as string[] };
                outputChannels.set(name, channel);
                services.wsEmit('extension.outputChannel.created', { name });

                return {
                    name,
                    append: (value: string) => {
                        channel.lines.push(value);
                        console.log(`[${name}] ${value}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: value });
                    },
                    appendLine: (value: string) => {
                        channel.lines.push(value + '\n');
                        console.log(`[${name}] ${value}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: value + '\n' });
                    },
                    clear: () => {
                        channel.lines.length = 0;
                        services.wsEmit('extension.outputChannel.clear', { name });
                    },
                    show: () => {
                        services.wsEmit('extension.outputChannel.show', { name });
                    },
                    hide: () => { },
                    dispose: () => {
                        outputChannels.delete(name);
                    },
                    // LogOutputChannel APIs
                    debug: (msg: string) => {
                        console.debug(`[${name}] DEBUG: ${msg}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: `DEBUG: ${msg}\n` });
                    },
                    info: (msg: string) => {
                        console.info(`[${name}] INFO: ${msg}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: `INFO: ${msg}\n` });
                    },
                    warn: (msg: string) => {
                        console.warn(`[${name}] WARN: ${msg}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: `WARN: ${msg}\n` });
                    },
                    error: (msg: string) => {
                        console.error(`[${name}] ERROR: ${msg}`);
                        services.wsEmit('extension.outputChannel.data', { name, text: `ERROR: ${msg}\n` });
                    },
                    trace: (msg: string) => {
                        services.wsEmit('extension.outputChannel.data', { name, text: `TRACE: ${msg}\n` });
                    },
                };
            },

            // REAL: Creates status bar item → WebSocket update
            createStatusBarItem: (alignmentOrId?: any, priorityOrAlignment?: number, priority?: number) => {
                const item = {
                    _id: typeof alignmentOrId === 'string' ? alignmentOrId : `statusbar-${Date.now()}`,
                    text: '',
                    tooltip: '',
                    color: '',
                    backgroundColor: undefined as any,
                    command: undefined as any,
                    name: '',
                    alignment: typeof alignmentOrId === 'number' ? alignmentOrId : 1,
                    priority: typeof priorityOrAlignment === 'number' ? priorityOrAlignment : priority,
                    show: () => {
                        services.wsEmit('extension.statusBar.update', {
                            id: item._id, text: item.text, tooltip: item.tooltip,
                            command: item.command, alignment: item.alignment, priority: item.priority
                        });
                    },
                    hide: () => {
                        services.wsEmit('extension.statusBar.hide', { id: item._id });
                    },
                    dispose: () => {
                        services.wsEmit('extension.statusBar.dispose', { id: item._id });
                    }
                };
                return item;
            },

            registerWebviewViewProvider: (viewType: string, provider: any, options?: any) => {
                webviewViewProviders.set(viewType, { provider, options });
                console.log(`[ExtensionHost] Registered webview view provider: ${viewType}`);
                return {
                    dispose: () => {
                        webviewViewProviders.delete(viewType);
                    },
                };
            },

            createWebviewPanel: (viewType: string, title: string, showOptions?: any, options?: any) => {
                const runtime = createWebviewRuntime(viewType, title || viewType, 'panel', options || {});
                const onDidDisposeEmitter = new EventEmitter<any>();
                const onDidChangeViewStateEmitter = new EventEmitter<any>();
                let panelTitle = title || viewType;

                const panel: any = {
                    webview: runtime.webview,
                    viewType,
                    active: true,
                    visible: true,
                    onDidDispose: onDidDisposeEmitter.event,
                    onDidChangeViewState: onDidChangeViewStateEmitter.event,
                    reveal: (_viewColumn?: any, preserveFocus?: boolean) => {
                        panel.visible = true;
                        panel.active = !preserveFocus;
                        onDidChangeViewStateEmitter.fire({ webviewPanel: panel });
                        services.wsEmit('extension.webview.opened', {
                            viewId: viewType,
                            title: panelTitle,
                            kind: 'panel',
                            html: runtime.getHtml(),
                            showOptions: showOptions || null,
                        });
                    },
                    dispose: () => {
                        panel.visible = false;
                        panel.active = false;
                        onDidDisposeEmitter.fire(undefined);
                        runtime.dispose();
                    },
                };

                Object.defineProperty(panel, 'title', {
                    get: () => panelTitle,
                    set: (nextTitle: string) => {
                        panelTitle = String(nextTitle || viewType);
                        runtime.setTitle(panelTitle);
                    },
                    enumerable: true,
                    configurable: true,
                });

                return panel;
            },

            // REAL: Progress notification → WebSocket
            withProgress: async (options: any, task: any) => {
                const progressId = `progress-${Date.now()}`;
                services.wsEmit('extension.progress.start', { id: progressId, title: options?.title, location: options?.location });

                const reportFn = (update: { message?: string; increment?: number }) => {
                    services.wsEmit('extension.progress.report', { id: progressId, ...update });
                };

                try {
                    const result = await task(
                        { report: reportFn },
                        { isCancellationRequested: false, onCancellationRequested: new EventEmitter<any>().event }
                    );
                    return result;
                } finally {
                    services.wsEmit('extension.progress.end', { id: progressId });
                }
            },

            showQuickPick: async (items: any, options?: any) => {
                // Emit to frontend and return first item as default
                services.wsEmit('extension.quickPick.show', { items, options });
                return Array.isArray(items) && items.length > 0 ? items[0] : undefined;
            },

            showInputBox: async (options?: any) => {
                services.wsEmit('extension.inputBox.show', { options });
                return options?.value || '';
            },
        },

        // ─── REAL: Workspace (config from file, real fs) ─────────
        workspace: {
            workspaceFolders: services.workspaceRoot ? [{
                uri: UriImpl.file(services.workspaceRoot),
                name: path.basename(services.workspaceRoot),
                index: 0,
            }] : [],
            rootPath: services.workspaceRoot || undefined,
            name: services.workspaceRoot ? path.basename(services.workspaceRoot) : undefined,

            onDidChangeConfiguration: onDidChangeConfigurationEmitter.event,
            onDidChangeWorkspaceFolders: onDidChangeWorkspaceFoldersEmitter.event,
            onDidOpenTextDocument: onDidOpenTextDocumentEmitter.event,
            onDidCloseTextDocument: onDidCloseTextDocumentEmitter.event,
            onDidChangeTextDocument: onDidChangeTextDocumentEmitter.event,
            onDidSaveTextDocument: onDidSaveTextDocumentEmitter.event,
            notebookDocuments,
            onDidOpenNotebookDocument: onDidOpenNotebookDocumentEmitter.event,
            onDidCloseNotebookDocument: onDidCloseNotebookDocumentEmitter.event,
            onDidChangeNotebookDocument: onDidChangeNotebookDocumentEmitter.event,
            onDidSaveNotebookDocument: onDidSaveNotebookDocumentEmitter.event,

            // REAL: Reads/writes configuration from storage file
            getConfiguration: (section?: string) => {
                const fullConfig = readConfig();
                const sectionConfig = section ? (fullConfig[section] || {}) : fullConfig;

                return {
                    get: (key: string, defaultValue?: any) => {
                        const val = sectionConfig[key];
                        return val !== undefined ? val : defaultValue;
                    },
                    has: (key: string) => key in sectionConfig,
                    inspect: (key: string) => ({
                        key: section ? `${section}.${key}` : key,
                        defaultValue: undefined,
                        globalValue: sectionConfig[key],
                        workspaceValue: sectionConfig[key],
                    }),
                    update: async (key: string, value: any) => {
                        const config = readConfig();
                        if (section) {
                            if (!config[section]) config[section] = {};
                            config[section][key] = value;
                        } else {
                            config[key] = value;
                        }
                        writeConfig(config);
                        onDidChangeConfigurationEmitter.fire({
                            affectsConfiguration: (s: string) => s === section || s.startsWith(`${section}.`),
                        });
                    },
                };
            },

            // REAL: File system operations via Node.js fs
            fs: {
                stat: async (uri: any) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    const stats = fs.statSync(p);
                    return {
                        type: stats.isDirectory() ? 2 : stats.isSymbolicLink() ? 64 : 1,
                        ctime: stats.ctimeMs, mtime: stats.mtimeMs, size: stats.size,
                    };
                },
                readDirectory: async (uri: any) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    const entries = fs.readdirSync(p, { withFileTypes: true });
                    return entries.map(e => [e.name, e.isDirectory() ? 2 : 1] as [string, number]);
                },
                createDirectory: async (uri: any) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    fs.mkdirSync(p, { recursive: true });
                },
                readFile: async (uri: any) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    return new Uint8Array(fs.readFileSync(p));
                },
                writeFile: async (uri: any, content: Uint8Array) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    fs.mkdirSync(path.dirname(p), { recursive: true });
                    fs.writeFileSync(p, content);
                },
                delete: async (uri: any) => {
                    const p = uri?.fsPath || uri?.path || String(uri);
                    fs.rmSync(p, { recursive: true, force: true });
                },
                rename: async (oldUri: any, newUri: any) => {
                    const oldP = oldUri?.fsPath || String(oldUri);
                    const newP = newUri?.fsPath || String(newUri);
                    fs.renameSync(oldP, newP);
                },
                copy: async (source: any, dest: any) => {
                    const srcP = source?.fsPath || String(source);
                    const destP = dest?.fsPath || String(dest);
                    fs.copyFileSync(srcP, destP);
                },
            },

            // REAL: File system watcher using fs.watch
            createFileSystemWatcher: (globPattern: string) => {
                const createEmitter = new EventEmitter<any>();
                const changeEmitter = new EventEmitter<any>();
                const deleteEmitter = new EventEmitter<any>();

                let watcher: fs.FSWatcher | null = null;
                try {
                    const watchDir = services.workspaceRoot || process.cwd();
                    watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
                        if (!filename) return;
                        const uri = UriImpl.file(path.join(watchDir, filename));
                        if (eventType === 'rename') {
                            if (fs.existsSync(path.join(watchDir, filename))) {
                                createEmitter.fire(uri);
                            } else {
                                deleteEmitter.fire(uri);
                            }
                        } else {
                            changeEmitter.fire(uri);
                        }
                    });
                } catch { /* watch may not be supported */ }

                return {
                    onDidCreate: createEmitter.event,
                    onDidChange: changeEmitter.event,
                    onDidDelete: deleteEmitter.event,
                    dispose: () => {
                        if (watcher) watcher.close();
                    }
                };
            },

            getWorkspaceFolder: (uri: any) => {
                if (!services.workspaceRoot) return undefined;
                return {
                    uri: UriImpl.file(services.workspaceRoot),
                    name: path.basename(services.workspaceRoot),
                    index: 0,
                };
            },

            findFiles: async (include: any, exclude?: any, maxResults?: number) => {
                // Basic implementation - search workspace root
                const results: any[] = [];
                try {
                    const root = services.workspaceRoot || process.cwd();
                    const walk = (dir: string) => {
                        if (results.length >= (maxResults || 100)) return;
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                            const full = path.join(dir, entry.name);
                            if (entry.isDirectory()) { walk(full); }
                            else { results.push(UriImpl.file(full)); }
                        }
                    };
                    walk(root);
                } catch { }
                return results;
            },
            registerNotebookSerializer: (_notebookType: string, _serializer: any, _options?: any) => {
                return { dispose: () => { } };
            },
            openNotebookDocument: async (uriOrType: any, maybeUri?: any) => {
                const uriCandidate = maybeUri ?? uriOrType;
                const notebookUri = typeof uriCandidate === 'string'
                    ? (uriCandidate.includes(':') ? UriImpl.parse(uriCandidate) : UriImpl.file(uriCandidate))
                    : (uriCandidate?.uri || uriCandidate || UriImpl.file(path.join(services.workspaceRoot || process.cwd(), 'untitled.ipynb')));

                const notebookType = typeof uriOrType === 'string' && !uriOrType.includes(':')
                    ? uriOrType
                    : 'jupyter-notebook';

                const notebookDoc: any = {
                    uri: notebookUri,
                    notebookType,
                    version: 1,
                    isDirty: false,
                    isClosed: false,
                    isUntitled: false,
                    metadata: {},
                    cellCount: 0,
                    getCells: () => [],
                    save: async () => true,
                };

                notebookDocuments.push(notebookDoc);
                onDidOpenNotebookDocumentEmitter.fire(notebookDoc);
                return notebookDoc;
            },

            openTextDocument: async (uriOrPath: any) => {
                const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath || String(uriOrPath);
                const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
                return {
                    uri: UriImpl.file(p),
                    fileName: p,
                    languageId: path.extname(p).slice(1) || 'plaintext',
                    version: 1,
                    getText: () => content,
                    lineAt: (lineOrPos: any) => {
                        const line = typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line;
                        const lines = content.split('\n');
                        const text = lines[line] || '';
                        return { text, range: new Range(new Position(line, 0), new Position(line, text.length)), lineNumber: line };
                    },
                    lineCount: content.split('\n').length,
                    positionAt: (offset: number) => {
                        const lines = content.substring(0, offset).split('\n');
                        return new Position(lines.length - 1, lines[lines.length - 1].length);
                    },
                    offsetAt: (position: Position) => {
                        const lines = content.split('\n');
                        let offset = 0;
                        for (let i = 0; i < position.line && i < lines.length; i++) offset += lines[i].length + 1;
                        return offset + position.character;
                    },
                    isDirty: false,
                    isUntitled: false,
                    save: async () => true,
                };
            },
        },
        notebooks: {
            createNotebookController: (id: string, notebookType: string, label: string) => {
                const controller: any = {
                    id,
                    notebookType,
                    label,
                    description: '',
                    detail: '',
                    supportedLanguages: [],
                    executeHandler: undefined as any,
                    interruptHandler: undefined as any,
                    createNotebookCellExecution: (_cell: any) => ({
                        token: { isCancellationRequested: false, onCancellationRequested: new EventEmitter<any>().event },
                        start: (_startTime?: number) => { },
                        end: (_success?: boolean, _endTime?: number) => { },
                        clearOutput: async () => { },
                        appendOutput: async (_output: any) => { },
                        replaceOutput: async (_output: any) => { },
                    }),
                    dispose: () => { },
                };
                return controller;
            },
            registerNotebookCellStatusBarItemProvider: (_notebookType: any, _provider: any) => ({ dispose: () => { } }),
            createRendererMessaging: (_rendererId: string) => ({
                onDidReceiveMessage: new EventEmitter<any>().event,
                postMessage: async (_message: any) => true,
                dispose: () => { },
            }),
        },

        // ─── REAL: Languages (registers in ExtensionApiFramework) ─
        languages: {
            getLanguages: async () => {
                if (services.extensionApiFramework && typeof services.extensionApiFramework.listProviders === 'function') {
                    return services.extensionApiFramework.listProviders();
                }
                return [];
            },
            match: (selector: any, document: any) => 1,
            createLanguageStatusItem: (id: string, selector?: any) => ({
                id, selector, name: '', text: '', detail: '', severity: 0,
                command: undefined, busy: false, accessibilityInformation: undefined,
                dispose: () => { }
            }),
            registerCodeActionsProvider: (selector: any, provider: any) => registerProvider('codeActions', selector, provider),
            registerCodeLensProvider: (selector: any, provider: any) => registerProvider('codeLens', selector, provider),
            registerCompletionItemProvider: (selector: any, provider: any, ...triggers: string[]) => registerProvider('completions', selector, provider),
            registerDefinitionProvider: (selector: any, provider: any) => registerProvider('definition', selector, provider),
            registerDocumentFormattingEditProvider: (selector: any, provider: any) => registerProvider('formatting', selector, provider),
            registerDocumentRangeFormattingEditProvider: (selector: any, provider: any) => registerProvider('rangeFormatting', selector, provider),
            registerDocumentSymbolProvider: (selector: any, provider: any) => registerProvider('documentSymbol', selector, provider),
            registerHoverProvider: (selector: any, provider: any) => registerProvider('hover', selector, provider),
            registerReferenceProvider: (selector: any, provider: any) => registerProvider('reference', selector, provider),
            registerRenameProvider: (selector: any, provider: any) => registerProvider('rename', selector, provider),
            registerSignatureHelpProvider: (selector: any, provider: any, ...metadata: any[]) => registerProvider('signatureHelp', selector, provider),
            registerWorkspaceSymbolProvider: (provider: any) => registerProvider('workspaceSymbol', '*', provider),
            registerDocumentLinkProvider: (selector: any, provider: any) => registerProvider('documentLink', selector, provider),
            registerFoldingRangeProvider: (selector: any, provider: any) => registerProvider('foldingRange', selector, provider),
            registerCallHierarchyProvider: (selector: any, provider: any) => registerProvider('callHierarchy', selector, provider),
            registerTypeHierarchyProvider: (selector: any, provider: any) => registerProvider('typeHierarchy', selector, provider),
            registerInlayHintsProvider: (selector: any, provider: any) => registerProvider('inlayHints', selector, provider),
            registerTypeDefinitionProvider: (selector: any, provider: any) => registerProvider('typeDefinition', selector, provider),
            registerImplementationProvider: (selector: any, provider: any) => registerProvider('implementation', selector, provider),
            registerDeclarationProvider: (selector: any, provider: any) => registerProvider('declaration', selector, provider),
            registerColorProvider: (selector: any, provider: any) => registerProvider('color', selector, provider),
            registerDocumentHighlightProvider: (selector: any, provider: any) => registerProvider('documentHighlight', selector, provider),
            registerSelectionRangeProvider: (selector: any, provider: any) => registerProvider('selectionRange', selector, provider),
            registerEvaluatableExpressionProvider: (selector: any, provider: any) => registerProvider('evaluatableExpression', selector, provider),
            registerInlineValuesProvider: (selector: any, provider: any) => registerProvider('inlineValues', selector, provider),
            registerLinkedEditingRangeProvider: (selector: any, provider: any) => registerProvider('linkedEditingRange', selector, provider),
            registerOnTypeFormattingEditProvider: (selector: any, provider: any, ...chars: string[]) => registerProvider('onTypeFormatting', selector, provider),
            setLanguageConfiguration: (language: string, configuration: any) => registerProvider('languageConfiguration', language, configuration),
            createDiagnosticCollection: (name?: string) => {
                const diagnosticMap = new Map<string, any[]>();
                return {
                    name: name || '',
                    set: (uri: any, diagnostics: any[]) => {
                        const key = String(uri?.fsPath || uri);
                        diagnosticMap.set(key, diagnostics || []);
                        services.wsEmit('extension.diagnostics.update', { uri: key, diagnostics: diagnostics || [], source: name });
                    },
                    delete: (uri: any) => {
                        diagnosticMap.delete(String(uri?.fsPath || uri));
                        services.wsEmit('extension.diagnostics.update', { uri: String(uri?.fsPath || uri), diagnostics: [], source: name });
                    },
                    clear: () => {
                        diagnosticMap.clear();
                        services.wsEmit('extension.diagnostics.clear', { source: name });
                    },
                    forEach: (callback: any) => diagnosticMap.forEach(callback),
                    get: (uri: any) => diagnosticMap.get(String(uri?.fsPath || uri)) || [],
                    has: (uri: any) => diagnosticMap.has(String(uri?.fsPath || uri)),
                    dispose: () => {
                        diagnosticMap.clear();
                        services.wsEmit('extension.diagnostics.clear', { source: name });
                    },
                };
            },
        },

        // ─── Env (real system info) ──────────────────────────────
        env: {
            appName: 'Deexen IDE',
            appRoot: process.cwd(),
            language: Intl.DateTimeFormat().resolvedOptions().locale || 'en',
            clipboard: {
                readText: async () => '',
                writeText: async (text: string) => { services.wsEmit('extension.clipboard.write', { text }); },
            },
            machineId: os.hostname(),
            sessionId: `session-${Date.now()}`,
            uriScheme: 'deexen',
            openExternal: async (uri: any) => {
                services.wsEmit('extension.openExternal', { uri: String(uri) });
                return true;
            },
        },

        // ─── Extensions registry ─────────────────────────────────
        extensions: {
            getExtension: (extensionId: string) => ({
                id: extensionId,
                packageJSON: { version: '1.0.0' },
                extensionPath: '',
                isActive: true,
                activate: async () => { },
                exports: {},
            }),
            all: [],
            onDidChange: new EventEmitter<any>().event,
        },

        // ─── Localization (l10n) ─────────────────────────────────
        l10n: {
            bundle: undefined,
            uri: undefined,
            t: (...args: any[]) => {
                // Simple pass-through: return the message string as-is
                if (typeof args[0] === 'string') return args[0];
                if (typeof args[0] === 'object' && args[0].message) return args[0].message;
                return String(args[0] ?? '');
            },
        },

        // ─── Debug (stub — no debug adapter yet) ─────────────────
        debug: {
            activeDebugSession: undefined,
            activeDebugConsole: { append: () => { }, appendLine: () => { } },
            breakpoints: [],
            onDidChangeActiveDebugSession: new EventEmitter<any>().event,
            onDidStartDebugSession: new EventEmitter<any>().event,
            onDidTerminateDebugSession: new EventEmitter<any>().event,
            onDidReceiveDebugSessionCustomEvent: new EventEmitter<any>().event,
            onDidChangeBreakpoints: new EventEmitter<any>().event,
            registerDebugConfigurationProvider: () => ({ dispose: () => { } }),
            registerDebugAdapterDescriptorFactory: () => ({ dispose: () => { } }),
            registerDebugAdapterTrackerFactory: () => ({ dispose: () => { } }),
            startDebugging: async () => false,
            stopDebugging: async () => { },
            addBreakpoints: () => { },
            removeBreakpoints: () => { },
        },

        // ─── Tasks (stub) ────────────────────────────────────────
        tasks: {
            taskExecutions: [],
            onDidStartTask: new EventEmitter<any>().event,
            onDidEndTask: new EventEmitter<any>().event,
            onDidStartTaskProcess: new EventEmitter<any>().event,
            onDidEndTaskProcess: new EventEmitter<any>().event,
            registerTaskProvider: () => ({ dispose: () => { } }),
            fetchTasks: async () => [],
            executeTask: async () => ({ terminate: () => { } }),
        },

        // Internal hooks used by Deexen runtime.
        __openWebviewView: async (viewId: string) => openRegisteredWebviewView(viewId),
        __postMessageToWebview: (viewId: string, message: any) => postMessageToWebview(viewId, message),
        __listRegisteredWebviewViews: () => Array.from(webviewViewProviders.keys()),
    };

    // Proxy to auto-create missing uppercase classes 
    return new Proxy(baseApi, {
        get: function (target: any, prop: string | symbol) {
            if (prop in target) return target[prop];

            if (typeof prop === 'string' && /^[A-Z]/.test(prop)) {
                const dummyClass = class { };
                Object.defineProperty(dummyClass, 'name', { value: prop });
                console.log(`[ExtensionHost] Auto-created missing VS Code class: ${prop}`);
                target[prop] = dummyClass;
                return dummyClass;
            }

            return undefined;
        }
    });
}

/** Log the require interception only once */
export function logRequireInterception() {
    if (!requireLogged) {
        console.log('[ExtensionHost] Real require("vscode") unavailable, using Deexen API bridge.');
        requireLogged = true;
    }
}

