import * as path from 'path';
import { RPCServer, RPCClient } from './rpc';
import { ExtensionHost } from './extensionHost';
import { exec } from 'child_process';
import * as os from 'os';

async function main() {
    console.log('Starting Deexen Extension Host...');

    // Start RPC Server for Frontend to connect to
    const rpcServer = new RPCServer(8081);

    // Register Terminal Methods
    rpcServer.registerMethod('terminal.execute', (cmd: string, cwd?: string) => {
        return new Promise((resolve) => {
            console.log(`Executing: ${cmd}`);
            const options = { cwd: cwd || os.homedir() };

            exec(cmd, options, (error, stdout, stderr) => {
                resolve({
                    stdout: stdout || '',
                    stderr: stderr || (error ? error.message : ''),
                    exitCode: error ? (error.code || 1) : 0
                });
            });
        });
    });

    // Also support connecting as client to main process if needed (legacy/placeholder)
    // const rpcClient = new RPCClient('ws://localhost:8080'); 
    // ...

    // Initialize Extension Host (stub for now as we focus on terminal)
    // const host = new ExtensionHost(rpcClient); 

    console.log('Extension Host Ready. Listening on 8081...');

    // Keep alive
}

main().catch(err => console.error(err));
