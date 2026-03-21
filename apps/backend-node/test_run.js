const { io } = require('socket.io-client');

const socket = io('ws://localhost:3000', {
    transports: ['websocket'],
});

socket.on('connect', () => {
    console.log('Connected to terminal gateway:', socket.id);

    // Simulate frontend Code Editor payload
    socket.emit('terminal.run', {
        filename: 'tester.py',
        content: `print('Hello from Extension Host!')`,
        command: 'python.execInTerminal'
    });

    console.log('Fired terminal.run payload with python.execInTerminal command. Waiting for output...');
});

socket.on('terminal.data', (data) => {
    console.log('[PTY Output]', data);
});

socket.on('connect_error', (err) => {
    console.error('Connection Error:', err);
    process.exit(1);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

setTimeout(() => {
    console.log('Test complete.');
    process.exit(0);
}, 3000);
