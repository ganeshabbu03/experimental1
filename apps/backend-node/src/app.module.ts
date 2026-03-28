import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { GithubModule } from './github/github.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PrismaService } from './prisma.service';
import { TerminalGateway } from './terminal/terminal.gateway';
import { ExtensionHostService } from './terminal/extension-host.service';
import { ExtensionApiFrameworkService } from './terminal/extension-api-framework.service';
import { LspGateway } from './terminal/lsp.gateway';
import { ExtensionRegistryDbService } from './extensions/extension-registry-db.service';
import { OpenVsxClientService } from './extensions/openvsx-client.service';
import { VsixInstallerService } from './extensions/vsix-installer.service';
import { ExtensionManagerService } from './extensions/extension-manager.service';
import { CommandRegistryService } from './extensions/command-registry.service';
import { TerminalApiService } from './extensions/terminal-api.service';
import { ExtensionHostProcessService } from './extensions/extension-host-process.service';
import { ExtensionsGateway } from './extensions/extensions.gateway';
import { HealthController } from './health.controller';
import { OnlineCompilerService } from './compiler/online-compiler.service';

// Root Application Module
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
        GithubModule,
        WorkspaceModule,
    ],
    controllers: [HealthController],
    providers: [PrismaService, TerminalGateway, ExtensionHostService, ExtensionApiFrameworkService, LspGateway, ExtensionRegistryDbService, OpenVsxClientService, VsixInstallerService, ExtensionManagerService, CommandRegistryService, TerminalApiService, ExtensionHostProcessService, ExtensionsGateway, OnlineCompilerService],
    exports: [PrismaService],
})
export class AppModule { }


