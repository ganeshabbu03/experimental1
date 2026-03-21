import * as fs from 'fs';
import * as path from 'path';
import { RPCClient } from './rpc';

// Mocking the 'deexen' module loading provided to extensions
const Module = require('module');
const originalLoad = Module._load;

export class ExtensionHost {
    private extensions: Map<string, any> = new Map();
    private rpc: RPCClient;

    constructor(rpc: RPCClient) {
        this.rpc = rpc;
        this.patchModuleLoader();
    }

    private patchModuleLoader() {
        // Intercept 'require("deexen")' calls from extensions
        const that = this;
        Module._load = function (request: string, parent: any, isMain: boolean) {
            if (request === 'deexen') {
                return that.createDeexenAPI();
            }
            return originalLoad.apply(this, arguments);
        };
    }

    private createDeexenAPI() {
        return {
            window: {
                showInformationMessage: (message: string) => {
                    return this.rpc.call('window.showInformationMessage', [message]);
                },
                showErrorMessage: (message: string) => {
                    return this.rpc.call('window.showErrorMessage', [message]);
                }
            },
            commands: {
                registerCommand: (command: string, callback: (...args: any[]) => any) => {
                    console.log(`Registering command: ${command}`);
                    this.rpc.call('commands.registerCommand', [command]).catch(err => {
                        console.error(`Failed to register command ${command} with editor:`, err);
                    });

                    // Listen for when the editor invokes this command
                    // This relies on the RPC client subscribing to the command name
                    this.rpc.registerMethod(command, callback);

                    return {
                        dispose: () => {
                            // cleanup logic
                        }
                    };
                }
            }
        };
    }

    public async loadExtension(extensionPath: string) {
        const manifestPath = path.join(extensionPath, 'extension.json');
        if (!fs.existsSync(manifestPath)) {
            console.error(`No extension.json found at ${extensionPath}`);
            return;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`Loading extension: ${manifest.name}`);

        const mainFile = path.join(extensionPath, manifest.main);

        try {
            // Load the extension module
            // We use 'require' dynamically. The patched module loader handles 'deexen' import.
            // Note: In a real system, we'd sandbox this context more.
            const extensionModule = require(mainFile);

            if (extensionModule.activate) {
                const context = { subscriptions: [] };
                await Promise.resolve(extensionModule.activate(context));
                this.extensions.set(manifest.name, { module: extensionModule, context });
                console.log(`Extension ${manifest.name} activated successfully.`);
            }
        } catch (e) {
            console.error(`Error activating extension ${manifest.name}:`, e);
        }
    }
}
