import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ExtensionApiFrameworkService, LspProviderDefinition } from './extension-api-framework.service';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class LspGateway {
    constructor(private extensionApiFrameworkService: ExtensionApiFrameworkService) { }

    @SubscribeMessage('lsp.providers.list')
    handleListProviders() {
        return { providers: this.extensionApiFrameworkService.listProviders() };
    }

    @SubscribeMessage('lsp.registerProvider')
    handleRegisterProvider(
        @MessageBody() payload: LspProviderDefinition,
    ) {
        return this.extensionApiFrameworkService.registerLspProvider(payload);
    }

    @SubscribeMessage('lsp.analyze')
    handleAnalyze(
        @MessageBody() payload: { language: string; content: string },
        @ConnectedSocket() _client: Socket,
    ) {
        return this.extensionApiFrameworkService.analyze(payload?.language || '', payload?.content || '');
    }
}
