import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionRecord } from './contracts';
import { ExtensionRegistryDbService } from './extension-registry-db.service';
import { VsixInstallerService } from './vsix-installer.service';

@Injectable()
export class ExtensionManagerService {
    constructor(
        private readonly registry: ExtensionRegistryDbService,
        private readonly installer: VsixInstallerService,
    ) { }

    public listInstalled(): ExtensionRecord[] {
        return this.registry.list();
    }

    public async installFromOpenVsx(publisher: string, name: string, version?: string) {
        const record = await this.installer.installFromOpenVsx(publisher, name, version);
        const prev = this.registry.get(record.id);
        if (prev) {
            record.installedAt = prev.installedAt;
        }
        await this.registry.upsert(record);
        return record;
    }

    public async uninstall(extensionId: string) {
        const existing = this.registry.get(extensionId);
        if (!existing) return { ok: false, error: 'Not installed' };

        if (fs.existsSync(existing.installPath)) {
            fs.rmSync(existing.installPath, { recursive: true, force: true });
        }

        await this.registry.remove(extensionId);
        return { ok: true };
    }

    public async update(extensionId: string) {
        const existing = this.registry.get(extensionId);
        if (!existing) return { ok: false, error: 'Not installed' };

        const updated = await this.installFromOpenVsx(existing.publisher, existing.name);
        return { ok: true, record: updated };
    }

    public readWorkspaceContains(workspaceRoot: string, fileName: string): boolean {
        const needle = fileName.toLowerCase();
        const stack = [workspaceRoot];

        while (stack.length > 0) {
            const dir = stack.pop() as string;
            if (!fs.existsSync(dir)) continue;

            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isFile() && entry.name.toLowerCase() === needle) return true;
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git') continue;
                    stack.push(full);
                }
            }
        }

        return false;
    }
}
