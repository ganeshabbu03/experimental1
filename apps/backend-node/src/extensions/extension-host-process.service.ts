import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
    private child: ChildProcess | null = null;
    private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();

    constructor(
        private readonly manager: ExtensionManagerService,
        private readonly commands: CommandRegistryService,
        private readonly terminalApi: TerminalApiService,
    ) { }

    async onModuleInit() {
        await this.startHost();
        await this.reloadExtensions();
        await this.activateEvent('onStartupFinished');
    }

    async onModuleDestroy() {
        try {
            await this.call('deactivateAll');
        } catch { }
        if (this.child) this.child.kill();
    }

    private hostScriptPath() {
        const jsPath = path.resolve(__dirname, 'extension-host-process.js');
        if (fs.existsSync(jsPath)) return jsPath;
        return path.resolve(process.cwd(), 'src', 'extensions', 'extension-host-process.ts');
    }

    private async startHost() {
        if (this.child) return;

        const script = this.hostScriptPath();
        const isTs = script.endsWith('.ts');

        this.child = fork(script, [], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            execArgv: isTs ? ['-r', 'ts-node/register'] : [],
        });

        this.child.on('message', (msg: HostResponse) => this.handleHostMessage(msg));

        this.child.on('exit', () => {
            this.child = null;
        });
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
        if (!this.child) throw new Error('Extension host is not running');

        const requestId = randomUUID();
        const req: HostRequest = { requestId, type, payload };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`Extension host request timeout: ${type}`));
            }, 15000);

            this.pending.set(requestId, { resolve, reject, timer });
            this.child?.send(req);
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
