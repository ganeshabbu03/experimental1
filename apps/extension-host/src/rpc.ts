import { Client, Server } from 'rpc-websockets';

export class RPCClient {
    private client: Client;

    constructor(url: string = 'ws://localhost:8080') {
        this.client = new Client(url);
    }

    async connect(): Promise<void> {
        return new Promise((resolve) => {
            this.client.on('open', () => {
                console.log('Connected to Editor RPC Server');
                resolve();
            });
        });
    }

    registerMethod(method: string, callback: (...args: any[]) => any) {
        this.client.subscribe(method);
        this.client.on(method, callback);
    }

    async call(method: string, params: any[] = []): Promise<any> {
        return this.client.call(method, params);
    }
}

export class RPCServer {
    private server: Server;

    constructor(port: number = 8081) {
        this.server = new Server({
            port: port,
            host: 'localhost'
        });
        console.log(`RPC Server started on port ${port}`);
    }

    registerMethod(method: string, callback: (...args: any[]) => any) {
        this.server.register(method, callback);
    }
}
