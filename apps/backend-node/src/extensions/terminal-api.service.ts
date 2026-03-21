import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class TerminalApiService {
    private emitter = new EventEmitter();

    public onSendText(listener: (payload: { text: string; addNewLine?: boolean }) => void) {
        this.emitter.on('sendText', listener);
        return () => this.emitter.off('sendText', listener);
    }

    public sendText(text: string, addNewLine?: boolean) {
        this.emitter.emit('sendText', { text, addNewLine });
    }

    public emitEvent(eventName: string, payload: any) {
        this.emitter.emit(eventName, payload);
    }

    public onEvent(eventName: string, listener: (payload: any) => void) {
        this.emitter.on(eventName, listener);
        return () => this.emitter.off(eventName, listener);
    }
}

