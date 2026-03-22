declare module 'rpc-websockets' {
    export class Client {
        constructor(url: string, options?: any);
        on(event: string, callback: (...args: any[]) => void): void;
        call(method: string, params?: any[], timeout?: number): Promise<any>;
        subscribe(method: string): void;
        close(): void;
    }
}
