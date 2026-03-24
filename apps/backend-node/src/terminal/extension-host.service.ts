import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import * as _module from 'module';
import { createVscodeApi, registeredCommands, logRequireInterception, VscodeApiServices } from './vscode-api';
import { ExtensionApiFrameworkService } from './extension-api-framework.service';

@Injectable()
export class ExtensionHostService implements OnModuleInit {
    private ptyModule: any | null = null;
    private extensions: Map<string, any> = new Map();
    private isInitialized = false;
    private lastStorageSnapshot = '';
    private reloadPromise: Promise<void> | null = null;
    private runtimePathAdditions: string[] = [];
    private runtimeInstallPromises: Map<string, Promise<boolean>> = new Map();

    private currentVscodeApi: any = null;
    private wsEmitter: ((event: string, payload: any) => void) | null = null;

    constructor(private extensionApiFramework: ExtensionApiFrameworkService) { }

    async onModuleInit() {
        // Fire-and-forget: never block NestJS bootstrap
        this.safeInit().catch((err) => {
            console.error('[ExtensionHost] Background init failed:', err);
        });
    }

    private async safeInit() {
        this.ptyModule = this.loadNodePty();
        try {
            this.buildVscodeApi();
            this.hijackRequire();
            await this.reloadExtensions(true);
        } catch (error) {
            console.error('[ExtensionHost] Startup degraded due to initialization error:', error);
        }
    }


    /** Called by TerminalGateway to inject the real WebSocket emitter for the connected client */
    public setWebSocketEmitter(emitter: (event: string, payload: any) => void) {
        this.wsEmitter = emitter;
        this.buildVscodeApi();
    }

    private buildVscodeApi() {
        const cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
        const configPath = path.resolve(process.cwd(), 'storage', 'config', 'settings.json');

        const services: VscodeApiServices = {
            wsEmit: (event: string, payload: any) => {
                if (this.wsEmitter) {
                    this.wsEmitter(event, payload);
                }
            },
            ptySpawner: (options) => {
                const pty = this.ptyModule || this.loadNodePty();
                if (!pty) {
                    throw new Error('Terminal runtime unavailable: node-pty failed to load.');
                }
                const shell = options.shellPath || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
                const args = options.shellArgs || [];
                return pty.spawn(shell, args, {
                    name: 'xterm-color',
                    cols: 80,
                    rows: 30,
                    cwd: options.cwd || cwd,
                    env: (options.env || this.getTerminalEnv(process.env as any)) as any,
                });
            },
            workspaceRoot: cwd,
            configPath,
            extensionApiFramework: this.extensionApiFramework,
            terminalEnv: this.getTerminalEnv(process.env as any),
        };

        this.currentVscodeApi = createVscodeApi(services);
    }

    private hijackRequire() {
        if (this.isInitialized) return;

        const self = this;
        const originalLoad = (_module as any)._load;
        (_module as any)._load = function (request: string, parent: any, isMain: boolean) {
            if (request === 'vscode') {
                try {
                    const realVscode = originalLoad.call(this, request, parent, isMain);
                    if (realVscode && typeof realVscode === 'object') {
                        return realVscode;
                    }
                } catch {
                    // Fall through to Deexen API bridge
                }
                logRequireInterception();
                return self.currentVscodeApi;
            }
            return originalLoad.apply(this, arguments);
        };

        this.isInitialized = true;
        console.log('[ExtensionHost] Hijacked require("vscode") → Deexen API bridge.');
    }

    private loadNodePty() {
        if (this.ptyModule) {
            return this.ptyModule;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            this.ptyModule = require('node-pty');
            return this.ptyModule;
        } catch (error) {
            console.error('[ExtensionHost] Failed to load node-pty; terminal features will be disabled.', error);
            return null;
        }
    }

    private getStorageDir(): string {
        return path.resolve(process.cwd(), '../backend/storage/plugins/extracted');
    }

    private computeStorageSnapshot(storageDir: string): string {
        if (!fs.existsSync(storageDir)) {
            return 'missing';
        }

        const entries = fs.readdirSync(storageDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                const packageJsonPath = path.join(storageDir, entry.name, 'extension', 'package.json');
                const mtime = fs.existsSync(packageJsonPath)
                    ? fs.statSync(packageJsonPath).mtimeMs
                    : 0;
                return `${entry.name}:${mtime}`;
            })
            .sort();

        return entries.join('|');
    }

    private hasGoRelatedExtension(): boolean {
        for (const extInfo of this.extensions.values()) {
            const pkg = extInfo.packageJson || {};
            const searchable = [
                pkg.name || '',
                pkg.displayName || '',
                pkg.description || '',
                pkg.publisher || '',
                JSON.stringify(pkg.contributes?.commands || []),
                JSON.stringify(pkg.keywords || []),
            ].join(' ').toLowerCase();

            if (searchable.includes('golang') || searchable.includes('go language') || /\bgo\b/.test(searchable)) {
                return true;
            }
        }

        return false;
    }

    private computeWingetPathAdditions(): string[] {
        if (os.platform() !== 'win32') {
            return [];
        }

        const candidates = [
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps') : '',
            process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'WindowsApps') : '',
        ].filter(Boolean);

        const additions: string[] = [];
        for (const dir of candidates) {
            const wingetExe = path.join(dir, 'winget.exe');
            if (fs.existsSync(wingetExe)) {
                additions.push(dir);
            }
        }

        return Array.from(new Set(additions));
    }

    private computeRuntimePathAdditions(): string[] {
        const additions: string[] = [];

        additions.push(...this.computeWingetPathAdditions());

        if (os.platform() === 'win32' && this.hasGoRelatedExtension()) {
            const candidates = [
                process.env.GOROOT ? path.join(process.env.GOROOT, 'bin') : '',
                'C:\\Program Files\\Go\\bin',
                process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Go', 'bin') : '',
                process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'scoop', 'apps', 'go', 'current', 'bin') : '',
                process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'go', 'bin') : '',
            ].filter(Boolean);

            for (const dir of candidates) {
                const goExe = path.join(dir, 'go.exe');
                if (fs.existsSync(goExe)) {
                    additions.push(dir);
                }
            }
        }

        return Array.from(new Set(additions));
    }

    private getPathKey(env: NodeJS.ProcessEnv): string {
        const key = Object.keys(env).find((k) => k.toLowerCase() === 'path');
        return key || 'PATH';
    }

    private applyRuntimePathAdditions(additions: string[]) {
        const pathKey = this.getPathKey(process.env);
        const delimiter = path.delimiter;
        const existing = (process.env[pathKey] || '').split(delimiter).filter(Boolean);
        const seen = new Set(existing.map((p) => p.toLowerCase()));

        for (const add of additions) {
            if (!seen.has(add.toLowerCase())) {
                existing.push(add);
                seen.add(add.toLowerCase());
            }
        }

        process.env[pathKey] = existing.join(delimiter);
    }

    public getTerminalEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
        const envCopy: NodeJS.ProcessEnv = { ...baseEnv };
        const pathKey = this.getPathKey(envCopy);
        const delimiter = path.delimiter;
        const existing = (envCopy[pathKey] || '').split(delimiter).filter(Boolean);
        const seen = new Set(existing.map((p) => p.toLowerCase()));

        for (const add of this.runtimePathAdditions) {
            if (!seen.has(add.toLowerCase())) {
                existing.push(add);
                seen.add(add.toLowerCase());
            }
        }

        envCopy[pathKey] = existing.join(delimiter);
        return envCopy;
    }

    public resolveExecutable(commandName: string): string | null {
        const isWindows = os.platform() === 'win32';
        const names = isWindows
            ? (commandName.toLowerCase().endsWith('.exe') ? [commandName] : [commandName, `${commandName}.exe`])
            : [commandName];

        const delimiter = path.delimiter;
        const pathKey = this.getPathKey(process.env);
        const pathSegments = (process.env[pathKey] || '').split(delimiter).filter(Boolean);

        for (const dir of pathSegments) {
            for (const name of names) {
                const full = path.join(dir, name);
                if (fs.existsSync(full)) {
                    return full;
                }
            }
        }

        return null;
    }

    private resolveWingetExecutable(): string | null {
        const fromPath = this.resolveExecutable('winget');
        if (fromPath) {
            return fromPath;
        }

        for (const dir of this.computeWingetPathAdditions()) {
            const candidate = path.join(dir, 'winget.exe');
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private async installGoRuntimeIfNeeded(): Promise<boolean> {
        if (os.platform() !== 'win32') return false;
        if (this.resolveExecutable('go')) return true;

        const wingetExecutable = this.resolveWingetExecutable();
        if (!wingetExecutable) {
            console.warn('[ExtensionHost] Go auto-install skipped: winget executable was not found.');
            return false;
        }

        const existingPromise = this.runtimeInstallPromises.get('go');
        if (existingPromise) {
            return existingPromise;
        }

        const installPromise = new Promise<boolean>((resolve) => {
            execFile(
                wingetExecutable,
                ['install', '--id', 'GoLang.Go', '-e', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements'],
                { timeout: 8 * 60 * 1000, windowsHide: true },
                (error, stdout, stderr) => {
                    if (error) {
                        console.warn(`[ExtensionHost] Go auto-install failed: ${error.message}`);
                    }
                    if (stderr && stderr.trim().length > 0) {
                        console.warn(`[ExtensionHost] winget stderr: ${stderr.trim()}`);
                    }
                    if (stdout && stdout.trim().length > 0) {
                        console.log(`[ExtensionHost] winget stdout: ${stdout.trim()}`);
                    }

                    this.runtimePathAdditions = this.computeRuntimePathAdditions();
                    this.applyRuntimePathAdditions(this.runtimePathAdditions);
                    resolve(!!this.resolveExecutable('go'));
                }
            );
        });

        this.runtimeInstallPromises.set('go', installPromise);
        const ok = await installPromise;
        this.runtimeInstallPromises.delete('go');
        return ok;
    }

    public getRuntimeHelpText(language: 'go'): string {
        if (language !== 'go') {
            return 'Runtime not found.';
        }

        if (this.resolveExecutable('go')) {
            return 'Go runtime is available.';
        }

        if (os.platform() !== 'win32') {
            return 'Go runtime not found. Install Go from https://go.dev/dl/ and ensure PATH includes go.';
        }

        if (this.resolveWingetExecutable()) {
            return 'Go runtime not found. Auto-install may have failed. Run: winget install --id GoLang.Go -e --source winget, then restart backend-node.';
        }

        return 'Go runtime not found and winget is unavailable in backend environment. Install Go from https://go.dev/dl/ and restart backend-node.';
    }

    public async ensureRuntimeAvailable(language: 'go'): Promise<boolean> {
        await this.reloadExtensions();

        if (language === 'go') {
            if (this.resolveExecutable('go')) return true;
            return this.installGoRuntimeIfNeeded();
        }

        return false;
    }

    private async reloadExtensions(force: boolean = false) {
        if (this.reloadPromise) {
            await this.reloadPromise;
            return;
        }

        this.reloadPromise = (async () => {
            const storageDir = this.getStorageDir();
            const snapshot = this.computeStorageSnapshot(storageDir);

            if (!force && snapshot === this.lastStorageSnapshot) {
                return;
            }

            this.extensions.clear();
            registeredCommands.clear();

            if (!fs.existsSync(storageDir)) {
                this.runtimePathAdditions = this.computeRuntimePathAdditions();
                this.applyRuntimePathAdditions(this.runtimePathAdditions);
                this.lastStorageSnapshot = snapshot;
                console.warn(`[ExtensionHost] Storage directory not found at ${storageDir}`);
                return;
            }

            const entries = fs.readdirSync(storageDir, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const extInfo = await this.tryLoadExtension(path.join(storageDir, entry.name));
                if (extInfo) {
                    this.extensions.set(extInfo.id, extInfo);
                }
            }

            this.runtimePathAdditions = this.computeRuntimePathAdditions();
            this.applyRuntimePathAdditions(this.runtimePathAdditions);

            this.lastStorageSnapshot = snapshot;
            console.log(`[ExtensionHost] Loaded ${this.extensions.size} extensions.`);
            if (this.runtimePathAdditions.length > 0) {
                console.log(`[ExtensionHost] Added runtime PATH entries: ${this.runtimePathAdditions.join(', ')}`);
            }
        })();

        try {
            await this.reloadPromise;
        } finally {
            this.reloadPromise = null;
        }
    }

    private async tryLoadExtension(extPath: string): Promise<any | null> {
        try {
            const packageJsonPath = path.join(extPath, 'extension', 'package.json');
            if (!fs.existsSync(packageJsonPath)) return null;

            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const mainFile = pkg.main;

            if (!mainFile) {
                console.log(`[ExtensionHost] Skipping ${pkg.name}: No main entrypoint.`);
                return null;
            }

            const mainPath = path.join(extPath, 'extension', mainFile);
            if (!fs.existsSync(mainPath) && !fs.existsSync(mainPath + '.js')) {
                console.log(`[ExtensionHost] Skipping ${pkg.name}: Main entrypoint not found at ${mainPath}`);
                return null;
            }
            const extId = `${pkg.publisher}.${pkg.name}`;

            console.log(`[ExtensionHost] Loading extension: ${extId}`);

            const extensionModule = require(mainPath);

            const context = {
                subscriptions: [],
                workspaceState: { get: () => undefined, update: () => { } },
                globalState: { get: () => undefined, update: () => { } },
                extensionPath: path.join(extPath, 'extension'),
                globalStoragePath: path.join(extPath, 'globalStorage'),
                logPath: path.join(extPath, 'logs'),
                extensionUri: this.currentVscodeApi.Uri.file(path.join(extPath, 'extension')),
            };

            if (typeof extensionModule.activate === 'function') {
                await extensionModule.activate(context);
                console.log(`[ExtensionHost] Activated ${extId} successfully.`);
            }

            return {
                id: extId,
                packageJson: pkg,
                module: extensionModule,
                context
            };
        } catch (err) {
            console.error(`[ExtensionHost] Failed to load extension at ${extPath}:`, err);
            return null;
        }
    }

    public async executeCommand(command: string, ...args: any[]) {
        await this.reloadExtensions();
        return this.currentVscodeApi.commands.executeCommand(command, ...args);
    }

    public async getRegisteredCommands() {
        await this.reloadExtensions();
        return Array.from(registeredCommands.keys());
    }

    public async openWebviewView(viewId: string) {
        await this.reloadExtensions();

        const api = this.currentVscodeApi as any;
        if (!api) {
            return { ok: false, error: 'VS Code API bridge is not initialized.' };
        }

        const openFn = api.__openWebviewView;
        if (typeof openFn !== 'function') {
            return { ok: false, error: 'Webview view support is not available in the runtime bridge.' };
        }

        let opened = await Promise.resolve(openFn(viewId));
        if (opened) {
            return { ok: true, opened: true };
        }

        // Some extensions expose commands to open their side panel instead of opening on view activation.
        // Try common command patterns based on view prefix (e.g. "zencoder.webview" -> "zencoder.open-view").
        const commandPrefix = String(viewId || '').split('.')[0];
        const fallbackCommands = Array.from(new Set([
            `${commandPrefix}.open-view`,
            `${commandPrefix}.show-panel`,
            `${commandPrefix}.show-view`,
            `${commandPrefix}.openView`,
            `${commandPrefix}.showPanel`,
        ]));

        const fallbackArgsList: any[][] = [
            [],
            [viewId],
            [{ viewId }],
            [{ id: viewId }],
            [commandPrefix],
        ];

        for (const command of fallbackCommands) {
            if (!registeredCommands.has(command)) continue;

            for (const args of fallbackArgsList) {
                try {
                    await this.currentVscodeApi.commands.executeCommand(command, ...args);
                } catch (err) {
                    console.warn(`[ExtensionHost] Failed executing fallback webview command ${command} with args ${JSON.stringify(args)}:`, err);
                }
            }
        }

        opened = await Promise.resolve(openFn(viewId));
        if (opened) {
            return { ok: true, opened: true };
        }

        return { ok: false, opened: false, error: `No webview view provider is registered for ${viewId}.` };
    }

    public async postMessageToWebview(viewId: string, message: any) {
        await this.reloadExtensions();

        const api = this.currentVscodeApi as any;
        if (!api || typeof api.__postMessageToWebview !== 'function') {
            return { ok: false, delivered: false, error: 'Webview messaging bridge is not available.' };
        }

        const delivered = !!api.__postMessageToWebview(viewId, message);
        return { ok: delivered, delivered };
    }

    public async getRunCommandForExtension(ext: string): Promise<string | undefined> {
        await this.reloadExtensions();
        const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        const langIdsByExt: Record<string, string[]> = {
            '.c': ['c'],
            '.h': ['c'],
            '.cpp': ['cpp', 'c++'],
            '.cc': ['cc', 'cpp', 'c++'],
            '.cxx': ['cxx', 'cpp', 'c++'],
            '.hpp': ['cpp', 'c++'],
            '.java': ['java'],
            '.py': ['python'],
            '.js': ['javascript'],
            '.ts': ['typescript'],
            '.go': ['go'],
            '.sh': ['shellscript', 'shell'],
        };
        const langCandidates = langIdsByExt[normalizedExt] || [];

        for (const extInfo of this.extensions.values()) {
            const menus = extInfo.packageJson?.contributes?.menus;
            if (menus && menus['editor/title/run']) {
                for (const menu of menus['editor/title/run']) {
                    const when: string = String(menu.when || '').toLowerCase();
                    const hasExtMatch = when.includes(normalizedExt);
                    const hasLangMatch = langCandidates.some((langId) =>
                        when.includes(`editorlangid == ${langId}`) ||
                        when.includes(`editorlangid==${langId}`) ||
                        when.includes(`editorlangid == '${langId}'`) ||
                        when.includes(`editorlangid=="${langId}"`) ||
                        when.includes(`editorlangid == "${langId}"`)
                    );
                    if (hasExtMatch || hasLangMatch) {
                        return menu.command;
                    }
                }
            }
        }
        return undefined;
    }

    public async refreshExtensions() {
        await this.reloadExtensions(true);
        return { extensionCount: this.extensions.size, runtimePathAdditions: this.runtimePathAdditions };
    }

    /** Get the current vscode API instance (for terminal.gateway usage) */
    public getVscodeApi() {
        return this.currentVscodeApi;
    }
}


