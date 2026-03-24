import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fork, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { ExtensionManagerService } from './extension-manager.service';
import { CommandRegistryService } from './command-registry.service';
import { TerminalApiService } from './terminal-api.service';
import { HostRequest, HostResponse } from './contracts';

@Injectable()
export class ExtensionHostProcessService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ExtensionHostProcessService.name);
    private child: ChildProcess | null = null;
    private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();

    constructor(
        private readonly manager: ExtensionManagerService,
        private readonly commands: CommandRegistryService,
        private readonly terminalApi: TerminalApiService,
    ) { }

    async onModuleInit() {
        // Run extension host startup in background - never block NestJS bootstrap
        this.safeStartup().catch((err) => {
            this.logger.error(`Extension host background startup failed: ${err?.message || err}`);
        });
    }

    private async safeStartup() {
        try {
            const started = await Promise.race([
                this.startHost(),
                new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Host startup timeout (10s)')), 10000)),
            ]);

            if (!started) {
                this.logger.warn('Extension host is unavailable at startup; continuing without extension runtime.');
                return;
            }

            await Promise.race([
                (async () => {
                    await this.reloadExtensions();
                    await this.activateEvent('onStartupFinished');
                })(),
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Extension reload/activate timeout (15s)')), 15000)),
            ]);
        } catch (error) {
            this.logger.error(`Extension host startup sequence failed: ${(error as Error)?.message || error}`);
        }
    }


    async onModuleDestroy() {
        try {
            await this.call('deactivateAll');
        } catch { }
        if (this.child) this.child.kill();
    }

    private hostScriptPath(): string | null {
        const candidates = [
            path.resolve(__dirname, 'extension-host-process.js'),
            path.resolve(process.cwd(), 'dist', 'extensions', 'extension-host-process.js'),
            path.resolve(process.cwd(), 'src', 'extensions', 'extension-host-process.ts'),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return candidate;
        }

        return null;
    }

    private async startHost(): Promise<boolean> {
        if (this.child) return true;

        const script = this.hostScriptPath();
        if (!script) {
            this.logger.warn('Extension host script not found in dist or src; skipping host process startup.');
            return false;
        }

        const isTs = script.endsWith('.ts');
        const execArgv: string[] = [];

        if (isTs) {
            try {
                require.resolve('ts-node/register');
                execArgv.push('-r', 'ts-node/register');
            } catch {
                this.logger.error(`Extension host fallback script is TypeScript (${script}) but ts-node is unavailable.`);
                return false;
            }
        }

        try {
            this.child = fork(script, [], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                execArgv,
            });
        } catch (error) {
            this.child = null;
            this.logger.error(`Failed to fork extension host (${script}): ${(error as Error)?.message || error}`);
            return false;
        }

        this.child.on('message', (msg: HostResponse) => this.handleHostMessage(msg));

        this.child.on('error', (error) => {
            this.logger.error(`Extension host process error: ${error?.message || error}`);
        });

        this.child.on('exit', (code, signal) => {
            this.logger.warn(`Extension host exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
            this.child = null;
        });

        return true;
    }

    private handleHostMessage(msg: HostResponse) {
        if (msg.type === 'response' && msg.requestId) {
            const pending = this.pending.get(msg.requestId);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.pending.delete(msg.requestId);
            if (msg.ok) pending.resolve(msg.payload);
            else pending.reject(new Error(msg.error || 'Host request failed'));
            return;
        }

        if (msg.type === 'event') {
            if (msg.name === 'commandRegistered') {
                const commandId = String(msg.payload?.commandId || '');
                const extensionId = String(msg.payload?.extensionId || 'unknown');
                if (commandId) {
                    this.commands.register({ id: commandId, title: commandId, extensionId });
                }
            }

            if (msg.name === 'commandUnregistered') {
                const extensionId = String(msg.payload?.extensionId || 'unknown');
                this.commands.unregisterByExtension(extensionId);
            }

            if (msg.name === 'terminalSendText') {
                this.terminalApi.sendText(String(msg.payload?.text || ''), !!msg.payload?.addNewLine);
            }

            if (msg.name === 'terminalCreate') {
                // Emit terminal creation event for the frontend to handle
                this.terminalApi.emitEvent('terminalCreate', msg.payload);
            }

            if (msg.name === 'terminalShow' || msg.name === 'terminalDispose') {
                this.terminalApi.emitEvent(msg.name, msg.payload);
            }

            if (msg.name === 'outputChannel' || msg.name === 'outputChannelClear' || msg.name === 'outputChannelShow') {
                this.terminalApi.emitEvent(msg.name, msg.payload);
            }

            if (msg.name === 'windowWarning') {
                this.terminalApi.emitEvent('windowWarning', msg.payload);
            }

            if (msg.name === 'terminalProfileRegistered') {
                this.terminalApi.emitEvent('terminalProfileRegistered', msg.payload);
            }
        }
    }

    private async call(type: HostRequest['type'], payload?: any): Promise<any> {
        if (!this.child) {
            const started = await this.startHost();
            if (!started || !this.child) {
                throw new Error('Extension host is unavailable');
            }
        }

        const requestId = randomUUID();
        const req: HostRequest = { requestId, type, payload };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`Extension host request timeout: ${type}`));
            }, 15000);

            this.pending.set(requestId, { resolve, reject, timer });
            try {
                this.child?.send(req);
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(requestId);
                reject(error);
            }
        });
    }

    public async reloadExtensions() {
        const extensions = this.manager.listInstalled().filter((e) => e.enabled);
        return this.call('loadExtensions', { extensions });
    }

    public async activateEvent(event: string, payload?: any) {
        return this.call('activateEvent', { event, payload });
    }

    public async executeCommand(command: string, args: any[] = []) {
        return this.call('executeCommand', { command, args });
    }

    public async getStatus() {
        return this.call('getStatus');
    }
}
