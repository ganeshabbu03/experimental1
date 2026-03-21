import { Injectable } from '@nestjs/common';

export interface RegisteredCommand {
    id: string;
    title: string;
    extensionId: string;
}

@Injectable()
export class CommandRegistryService {
    private commands = new Map<string, RegisteredCommand>();

    public register(command: RegisteredCommand) {
        this.commands.set(command.id, command);
    }

    public unregisterByExtension(extensionId: string) {
        for (const [id, cmd] of this.commands.entries()) {
            if (cmd.extensionId === extensionId) this.commands.delete(id);
        }
    }

    public list(): RegisteredCommand[] {
        return Array.from(this.commands.values()).sort((a, b) => a.id.localeCompare(b.id));
    }

    public get(commandId: string): RegisteredCommand | undefined {
        return this.commands.get(commandId);
    }
}
