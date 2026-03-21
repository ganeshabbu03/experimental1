import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, OnGatewayConnection } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ExtensionManagerService } from './extension-manager.service';
import { ExtensionHostProcessService } from './extension-host-process.service';
import { CommandRegistryService } from './command-registry.service';
import { TerminalApiService } from './terminal-api.service';
import { ExtensionRegistryDbService } from './extension-registry-db.service';

@WebSocketGateway({
    cors: { origin: '*' },
})
export class ExtensionsGateway implements OnGatewayConnection {
    constructor(
        private readonly manager: ExtensionManagerService,
        private readonly host: ExtensionHostProcessService,
        private readonly commands: CommandRegistryService,
        private readonly terminalApi: TerminalApiService,
        private readonly registry: ExtensionRegistryDbService,
    ) { }

    handleConnection(client: Socket) {
        // Forward extension host events to connected WebSocket clients
        const eventNames = [
            'terminalCreate', 'terminalShow', 'terminalDispose',
            'outputChannel', 'outputChannelClear', 'outputChannelShow',
            'windowWarning', 'terminalProfileRegistered',
        ];

        const cleanups: (() => void)[] = [];
        for (const eventName of eventNames) {
            const off = this.terminalApi.onEvent(eventName, (payload) => {
                client.emit(`extensions.${eventName}`, payload);
            });
            cleanups.push(off);
        }

        client.on('disconnect', () => {
            cleanups.forEach((off) => off());
        });
    }

    @SubscribeMessage('extensions.list')
    listExtensions() {
        return { extensions: this.manager.listInstalled() };
    }

    @SubscribeMessage('extensions.install')
    async installExtension(
        @MessageBody() payload: { publisher: string; name: string; version?: string; trustPublisher?: boolean },
    ) {
        // Check publisher trust
        if (!payload.trustPublisher && !this.registry.isTrusted(payload.publisher)) {
            return { ok: false, requiresTrust: true, publisher: payload.publisher };
        }

        // Trust the publisher if explicitly requested
        if (payload.trustPublisher) {
            await this.registry.trustPublisher(payload.publisher);
        }

        const record = await this.manager.installFromOpenVsx(payload.publisher, payload.name, payload.version);
        await this.host.reloadExtensions();
        return { ok: true, record };
    }

    @SubscribeMessage('extensions.trustPublisher')
    async trustPublisher(
        @MessageBody() payload: { publisher: string },
    ) {
        await this.registry.trustPublisher(payload.publisher);
        return { ok: true, publisher: payload.publisher };
    }

    @SubscribeMessage('extensions.uninstall')
    async uninstallExtension(
        @MessageBody() payload: { extensionId: string },
    ) {
        const result = await this.manager.uninstall(payload.extensionId);
        await this.host.reloadExtensions();
        return result;
    }

    @SubscribeMessage('extensions.update')
    async updateExtension(
        @MessageBody() payload: { extensionId: string },
    ) {
        const result = await this.manager.update(payload.extensionId);
        await this.host.reloadExtensions();
        return result;
    }

    @SubscribeMessage('extensions.reload')
    async reloadExtensions() {
        const payload = await this.host.reloadExtensions();
        return { ok: true, payload };
    }

    @SubscribeMessage('extensions.status')
    async getStatus() {
        const status = await this.host.getStatus();
        return { ok: true, ...status };
    }

    @SubscribeMessage('extensions.activate.onFileOpen')
    async onFileOpen(@MessageBody() payload: { filePath: string; language?: string }) {
        await this.host.activateEvent('onFileOpen', payload);
        if (payload?.language) {
            await this.host.activateEvent('onLanguage', { language: payload.language });
        }
        return { ok: true };
    }

    @SubscribeMessage('extensions.activate.workspaceContains')
    async workspaceContains(@MessageBody() payload: { workspaceRoot: string; fileName: string }) {
        const found = this.manager.readWorkspaceContains(payload.workspaceRoot, payload.fileName);
        if (found) {
            await this.host.activateEvent('workspaceContains', { path: payload.fileName });
        }
        return { ok: true, found };
    }

    @SubscribeMessage('extensions.commands.list')
    listCommands() {
        return { commands: this.commands.list() };
    }

    @SubscribeMessage('extensions.command.execute')
    async executeCommand(
        @MessageBody() payload: { command: string; args?: any[] },
        @ConnectedSocket() client: Socket,
    ) {
        const off = this.terminalApi.onSendText(({ text, addNewLine }) => {
            client.emit('terminal.data', `${text}${addNewLine ? '\r\n' : ''}`);
        });

        try {
            const response = await this.host.executeCommand(payload.command, payload.args || []);
            return { ok: true, response };
        } finally {
            off();
        }
    }
}

