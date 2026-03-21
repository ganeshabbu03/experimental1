/**
 * PowerShell Extension API Definitions.
 */

export interface TerminalOptions {
    name?: string;
    cwd?: string;
    env?: Record<string, string>;
    kind: 'integrated' | 'headless';
    shellArgs?: string[];
}

export interface Terminal {
    readonly id: string;
    readonly pid: number;

    sendText(text: string, execute?: boolean): void;
    show(): void;
    dispose(): void;

    // Event listener for data
    onData(listener: (data: string) => void): void;
}

export interface ShellResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface ShellResolver {
    resolve(): Promise<string[]>; // Returns paths to found shells
}

export interface ShellApi {
    registerShellResolver(resolver: ShellResolver): void;
    runScript(scriptPath: string, args: string[]): Promise<ShellResult>;
    createTerminal(options: TerminalOptions): Promise<Terminal>;
}
