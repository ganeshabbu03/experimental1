import * as vscode from 'vscode';

/**
 * Factory to create the Debug Adapter for PowerShell.
 * Hooks into PowerShell Editor Services (PSES).
 */
export class PowerShellDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

    constructor(private psesPath: string) { }

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

        // Launch PSES in "Debug Server" mode
        // This talks DAP over stdin/stdout
        const command = 'pwsh';
        const args = [
            '-NoProfile',
            '-File', this.psesPath,
            '-BundledModulesPath', './modules',
            '-LogPath', './logs/pses.log',
            '-SessionDetailsPath', './logs/session.json',
            '-FeatureFlags', 'PSReadLine'
        ];

        console.log(`Launching Debug Adapter: ${command} ${args.join(' ')}`);

        return new vscode.DebugAdapterExecutable(command, args);
    }
}
