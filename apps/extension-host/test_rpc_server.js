const WebSocket = require('ws');
const { Server } = require('rpc-websockets');

console.log('Starting Test Editor RPC Server on port 8080...');

const server = new Server({
    port: 8080,
    host: 'localhost'
});

// Register events the editor supports (mocking the real editor)
server.register('window.showInformationMessage', (params) => {
    console.log('[EDITOR] Show Info:', params[0]);
    return Promise.resolve();
});

server.register('window.showErrorMessage', (params) => {
    console.log('[EDITOR] Show Error:', params[0]);
    return Promise.resolve();
});

server.register('commands.registerCommand', (params) => {
    const commandId = params[0];
    console.log('[EDITOR] Command Registered:', commandId);

    // Simulate triggering the command after a delay
    if (commandId === 'hello-world.hello') {
        setTimeout(() => {
            console.log(`[EDITOR] Triggering command '${commandId}'...`);
            // In rpc-websockets, 'emit' is used for notifications or we can call back if registered
            // Since we used 'registerMethod' in the client which subscribes, we should emit an event.
            server.emit(commandId, []);
        }, 2000);
    }
    return Promise.resolve();
});

console.log('Test Mock Editor Server Ready.');
