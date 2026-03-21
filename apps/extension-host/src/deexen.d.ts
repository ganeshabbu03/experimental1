declare module 'deexen' {
    /**
     * Namespace for interactions with the editor UI.
     */
    export namespace window {
        /**
         * Show an information message to the user.
         */
        export function showInformationMessage(message: string): Thenable<void>;

        /**
         * Show an error message to the user.
         */
        export function showErrorMessage(message: string): Thenable<void>;

        /**
         * Show a warning message to the user.
         */
        export function showWarningMessage(message: string): Thenable<void>;

        /**
         * Create a new integrated terminal.
         */
        export function createTerminal(name?: string, shellPath?: string, shellArgs?: string[]): Terminal;
        export function createTerminal(options: TerminalOptions): Terminal;

        /**
         * Create an output channel for extension logging.
         */
        export function createOutputChannel(name: string): OutputChannel;

        /**
         * Register a terminal profile provider.
         */
        export function registerTerminalProfileProvider(id: string, provider: TerminalProfileProvider): Disposable;
    }

    /**
     * Namespace for commands.
     */
    export namespace commands {
        /**
         * Register a command that can be invoked via the command palette or keybindings.
         */
        export function registerCommand(command: string, callback: (...args: any[]) => any): Disposable;

        /**
         * Execute a command by ID.
         */
        export function executeCommand(command: string, ...args: any[]): Thenable<any>;
    }

    /**
     * Namespace for workspace operations.
     */
    export namespace workspace {
        /**
         * Get a configuration object.
         */
        export function getConfiguration(section?: string): WorkspaceConfiguration;

        export const workspaceFolders: any[] | undefined;
        export const rootPath: string | undefined;
        export const name: string | undefined;
    }

    /**
     * Namespace for environment info.
     */
    export namespace env {
        export const appName: string;
        export const appRoot: string;
        export const language: string;
        export const machineId: string;
        export const uriScheme: string;
    }

    /**
     * Represents a cleanup object.
     */
    export interface Disposable {
        dispose(): void;
    }

    /**
     * Life-cycle entry points.
     */
    export interface ExtensionContext {
        subscriptions: Disposable[];
    }

    /**
     * Terminal options for createTerminal.
     */
    export interface TerminalOptions {
        name?: string;
        shellPath?: string;
        shellArgs?: string[];
        cwd?: string;
    }

    /**
     * Represents an integrated terminal.
     */
    export interface Terminal {
        readonly id: string;
        readonly name: string;
        sendText(text: string, addNewLine?: boolean): void;
        show(): void;
        dispose(): void;
    }

    /**
     * Output channel for extension logging.
     */
    export interface OutputChannel {
        readonly name: string;
        append(value: string): void;
        appendLine(value: string): void;
        clear(): void;
        show(): void;
        dispose(): void;
    }

    /**
     * Terminal profile provider.
     */
    export interface TerminalProfileProvider {
        provideTerminalProfile(token?: any): TerminalOptions | undefined;
    }

    /**
     * Workspace configuration.
     */
    export interface WorkspaceConfiguration {
        get<T>(key: string, defaultValue?: T): T | undefined;
        has(key: string): boolean;
        update(key: string, value: any): Thenable<void>;
    }
}
