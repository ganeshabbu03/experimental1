import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionRecord, ExtensionRegistryFile } from './contracts';

@Injectable()
export class ExtensionRegistryDbService {
    private registryPath = path.resolve(process.cwd(), 'storage', 'extensions', 'registry.json');
    private writeQueue: Promise<void> = Promise.resolve();

    private ensureStorage() {
        fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
        if (!fs.existsSync(this.registryPath)) {
            const seed: ExtensionRegistryFile = { version: 1, extensions: [], trustedPublishers: [] };
            fs.writeFileSync(this.registryPath, JSON.stringify(seed, null, 2), 'utf8');
        }
    }

    private readAllUnsafe(): ExtensionRegistryFile {
        this.ensureStorage();
        const raw = fs.readFileSync(this.registryPath, 'utf8');
        const parsed = JSON.parse(raw) as ExtensionRegistryFile;
        if (!parsed.extensions) parsed.extensions = [];
        if (!parsed.version) parsed.version = 1;
        if (!parsed.trustedPublishers) parsed.trustedPublishers = [];
        return parsed;
    }

    public list(): ExtensionRecord[] {
        return this.readAllUnsafe().extensions;
    }

    public get(id: string): ExtensionRecord | undefined {
        return this.list().find((e) => e.id === id);
    }

    public async upsert(record: ExtensionRecord): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            const db = this.readAllUnsafe();
            const idx = db.extensions.findIndex((e) => e.id === record.id);
            if (idx === -1) db.extensions.push(record);
            else db.extensions[idx] = record;
            fs.writeFileSync(this.registryPath, JSON.stringify(db, null, 2), 'utf8');
        });
        await this.writeQueue;
    }

    public async remove(id: string): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            const db = this.readAllUnsafe();
            db.extensions = db.extensions.filter((e) => e.id !== id);
            fs.writeFileSync(this.registryPath, JSON.stringify(db, null, 2), 'utf8');
        });
        await this.writeQueue;
    }

    // ─── Publisher Trust ──────────────────────────────────────────────

    public isTrusted(publisher: string): boolean {
        const db = this.readAllUnsafe();
        const trusted = db.trustedPublishers || [];
        return trusted.includes(publisher.toLowerCase());
    }

    public async trustPublisher(publisher: string): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            const db = this.readAllUnsafe();
            if (!db.trustedPublishers) db.trustedPublishers = [];
            const normalized = publisher.toLowerCase();
            if (!db.trustedPublishers.includes(normalized)) {
                db.trustedPublishers.push(normalized);
                fs.writeFileSync(this.registryPath, JSON.stringify(db, null, 2), 'utf8');
            }
        });
        await this.writeQueue;
    }

    public listTrustedPublishers(): string[] {
        return this.readAllUnsafe().trustedPublishers || [];
    }
}

