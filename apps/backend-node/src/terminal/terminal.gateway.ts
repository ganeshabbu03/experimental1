import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as os from 'os';

const isWindows = os.platform() === 'win32';

/**
 * Build a compile-and-run command that works in both PowerShell 5.x and bash.
 * PowerShell 5.x doesn't support &&, and paths with spaces need the & call operator.
 */
function buildCompileRunCommand(compileExe: string, compileArgs: string, runExe: string, runArgs: string): string {
    if (isWindows) {
        return `& "${compileExe}" ${compileArgs}; if ($LASTEXITCODE -eq 0) { & "${runExe}" ${runArgs} }`;
    }
    return `"${compileExe}" ${compileArgs} && "${runExe}" ${runArgs}`;
}

/** Build a single executable command, using & operator on Windows for paths with spaces */
function buildExecCommand(exe: string, args: string): string {
    if (isWindows) {
        return `& "${exe}" ${args}`;
    }
    return `"${exe}" ${args}`;
}
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionHostService } from './extension-host.service';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private ptyModule: any | null = null;
    private terminals: Map<string, any> = new Map();

    constructor(private extensionHostService: ExtensionHostService) {
        this.ptyModule = this.loadNodePty();
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
            console.error('[Terminal] Failed to load node-pty; terminal sockets will be disabled.', error);
            return null;
        }
    }

    handleConnection(client: Socket) {
        console.log(`[Terminal] Client connected: ${client.id}`);
        const pty = this.ptyModule || this.loadNodePty();
        if (!pty) {
            client.emit('terminal.error', 'Terminal backend is unavailable on this deployment.');
            return;
        }

        // Wire real WebSocket emitter so extensions can push events to this client
        this.extensionHostService.setWebSocketEmitter((event: string, payload: any) => {
            client.emit(event, payload);
        });

        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
            env: this.extensionHostService.getTerminalEnv(process.env as any) as any,
        });

        this.terminals.set(client.id, ptyProcess);

        ptyProcess.onData((data) => {
            client.emit('terminal.data', data);
        });

        ptyProcess.onExit((e) => {
            console.log(`[Terminal] Process exited for client ${client.id} with code ${e.exitCode}`);
            client.emit('terminal.exit', e.exitCode);
            client.disconnect();
        });
    }

    handleDisconnect(client: Socket) {
        console.log(`[Terminal] Client disconnected: ${client.id}`);
        const ptyProcess = this.terminals.get(client.id);
        if (ptyProcess) {
            ptyProcess.kill();
            this.terminals.delete(client.id);
        }
    }

    @SubscribeMessage('terminal.input')
    handleInput(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const ptyProcess = this.terminals.get(client.id);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    }

    @SubscribeMessage('terminal.resize')
    handleResize(
        @MessageBody() size: { cols: number; rows: number },
        @ConnectedSocket() client: Socket,
    ) {
        const ptyProcess = this.terminals.get(client.id);
        if (ptyProcess) {
            try {
                ptyProcess.resize(size.cols, size.rows);
            } catch (err) {
                console.error(`[Terminal] Resize error for client ${client.id}:`, err);
            }
        }
    }

    @SubscribeMessage('terminal.run')
    async handleRun(
        @MessageBody() payload: { filename: string; content: string; command?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const ptyProcess = this.terminals.get(client.id);
        if (!ptyProcess) return;

        try {
            const cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
            const requestedPath = String(payload.filename || '').replace(/\\/g, '/');
            const normalizedRelativePath = path.posix.normalize(requestedPath);
            if (!normalizedRelativePath || normalizedRelativePath.startsWith('..') || path.isAbsolute(requestedPath)) {
                ptyProcess.write(`\necho "Invalid file path for execution"\r`);
                return;
            }

            const filePath = path.join(cwd, normalizedRelativePath);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, payload.content);

            if (payload.command) {
                console.log(`[Terminal] Client ${client.id} executing extension command: ${payload.command}`);
                const vscodeApi = this.extensionHostService.getVscodeApi();
                await this.extensionHostService.executeCommand(payload.command, vscodeApi.Uri.file(filePath));
                return;
            }

            const ext = path.extname(payload.filename).toLowerCase();
            let command = '';

            const extensionCommand = await this.extensionHostService.getRunCommandForExtension(ext);
            if (extensionCommand) {
                console.log(`[Terminal] Client ${client.id} automatically routing to extension command: ${extensionCommand}`);
                const vscodeApi = this.extensionHostService.getVscodeApi();
                await this.extensionHostService.executeCommand(extensionCommand, vscodeApi.Uri.file(filePath));
                return;
            }

            if (ext === '.py') command = `python "${filePath}"`;
            else if (ext === '.js') command = `node "${filePath}"`;
            else if (ext === '.ts') command = `npx ts-node "${filePath}"`;
            else if (ext === '.sh') command = `bash "${filePath}"`;
            else if (ext === '.c') {
                const gcc = this.extensionHostService.resolveExecutable('gcc');
                const clang = this.extensionHostService.resolveExecutable('clang');
                const compiler = gcc || clang;
                if (!compiler) {
                    ptyProcess.write(`\necho "C compiler not found (gcc/clang). Install one and ensure PATH is set."\r`);
                    return;
                }
                const outputExe = `${filePath}.out.exe`;
                command = buildCompileRunCommand(compiler, `"${filePath}" -o "${outputExe}"`, outputExe, '');
            }
            else if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
                const gpp = this.extensionHostService.resolveExecutable('g++');
                const clangpp = this.extensionHostService.resolveExecutable('clang++');
                const compiler = gpp || clangpp;
                if (!compiler) {
                    ptyProcess.write(`\necho "C++ compiler not found (g++/clang++). Install one and ensure PATH is set."\r`);
                    return;
                }
                const outputExe = `${filePath}.out.exe`;
                command = buildCompileRunCommand(compiler, `"${filePath}" -o "${outputExe}"`, outputExe, '');
            }
            else if (ext === '.java') {
                const javac = this.extensionHostService.resolveExecutable('javac');
                const java = this.extensionHostService.resolveExecutable('java');
                if (!javac || !java) {
                    ptyProcess.write(`\necho "Java runtime/compiler not found (javac/java). Install JDK and ensure PATH is set."\r`);
                    return;
                }
                const className = path.parse(filePath).name;
                command = buildCompileRunCommand(javac, `"${filePath}"`, java, `-cp "${path.dirname(filePath)}" ${className}`);
            }
            else if (ext === '.go') {
                let goExecutable = this.extensionHostService.resolveExecutable('go');
                if (!goExecutable) {
                    await this.extensionHostService.ensureRuntimeAvailable('go');
                    goExecutable = this.extensionHostService.resolveExecutable('go');
                }
                if (!goExecutable) {
                    const hint = this.extensionHostService.getRuntimeHelpText('go').replace(/"/g, '\\"');
                    ptyProcess.write(`\necho "${hint}"\r`);
                    return;
                }
                command = buildExecCommand(goExecutable, `run "${filePath}"`);
            }
            else {
                ptyProcess.write(`\necho "Unsupported language extension for execution"\r`);
                return;
            }

            ptyProcess.write(`\nclear\r${command}\r`);
        } catch (err) {
            console.error(`[Terminal] Execute error for client ${client.id}:`, err);
            ptyProcess.write(`\necho "[Error executing file]"\r`);
        }
    }

    @SubscribeMessage('legacy.extensions.reload')
    async handleExtensionsReload() {
        return this.extensionHostService.refreshExtensions();
    }

    @SubscribeMessage('extensions.view.open')
    async handleOpenExtensionView(
        @MessageBody() payload: { viewId: string },
    ) {
        const viewId = String(payload?.viewId || '');
        if (!viewId) {
            return { ok: false, error: 'Missing viewId' };
        }

        return this.extensionHostService.openWebviewView(viewId);
    }

    @SubscribeMessage('extensions.webview.postMessage')
    async handleExtensionWebviewPostMessage(
        @MessageBody() payload: { viewId: string; message: any },
    ) {
        const viewId = String(payload?.viewId || '');
        if (!viewId) {
            return { ok: false, error: 'Missing viewId' };
        }

        return this.extensionHostService.postMessageToWebview(viewId, payload?.message);
    }

    @SubscribeMessage('legacy.extensions.commands.list')
    async handleListExtensionCommands() {
        const commands = await this.extensionHostService.getRegisteredCommands();
        return { commands };
    }

    @SubscribeMessage('legacy.extensions.command.execute')
    async handleExecuteExtensionCommand(
        @MessageBody() payload: { command: string; args?: any[] },
        @ConnectedSocket() client: Socket,
    ) {
        const command = payload?.command;
        if (!command) {
            return { ok: false, error: 'Missing command' };
        }

        await this.extensionHostService.executeCommand(command, ...(payload.args || []));
        return { ok: true };
    }
}


