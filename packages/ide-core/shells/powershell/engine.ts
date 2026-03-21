import * as pty from 'node-pty';
import * as os from 'os';
import { EventEmitter } from 'events';

/**
 * Manages a PowerShell PTY session.
 */
export class PowerShellEngine extends EventEmitter {
    private ptyProcess: pty.IPty | null = null;

    constructor(
        private shellPath: string = 'pwsh.exe',
        private cwd: string = os.homedir()
    ) {
        super();
    }

    /**
     * Spawns the PowerShell process with proper encoding and environment.
     */
    public start(): void {
        const shellArgs = [
            '-NoLogo',
            '-NoProfile',
            '-ExecutionPolicy', 'RemoteSigned',
            '-Command', '-' // Run in stdin mode
        ];

        // Windows ConPTY interaction requires specific environment setup
        const env = {
            ...process.env,
            StartingDir: this.cwd,
            TERM: 'xterm-256color',
            LANG: 'en_US.UTF-8'
        };

        try {
            this.ptyProcess = pty.spawn(this.shellPath, shellArgs, {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: this.cwd,
                env: env,
                useConpty: os.platform() === 'win32'
            });

            this.ptyProcess.onData((data: string) => {
                this.emit('data', data);
            });

            this.ptyProcess.onExit((res: { exitCode: number; signal?: number }) => {
                this.emit('exit', res.exitCode);
            });

            console.log(`PowerShell started with PID: ${this.ptyProcess.pid}`);
        } catch (error) {
            console.error('Failed to start PowerShell:', error);
            this.emit('error', error);
        }
    }

    public resize(cols: number, rows: number): void {
        this.ptyProcess?.resize(cols, rows);
    }

    public write(data: string): void {
        this.ptyProcess?.write(data);
    }

    public kill(): void {
        this.ptyProcess?.kill();
    }
}
