import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { ExtensionManifest, ExtensionRecord } from './contracts';
import { OpenVsxClientService } from './openvsx-client.service';
import { resolveExtensionStorageRoot } from './extension-storage.util';

@Injectable()
export class VsixInstallerService {
    constructor(private readonly openVsxClient: OpenVsxClientService) { }

    private runCommand(command: string, args: string[], label: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const p = spawn(command, args, { stdio: 'ignore' });
            p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (${code})`)));
            p.on('error', reject);
        });
    }

    private async extractWithPython(vsixPath: string, dest: string): Promise<void> {
        const candidates = ['python3', 'python'];
        let lastError: unknown = null;

        for (const candidate of candidates) {
            try {
                await this.runCommand(candidate, ['-m', 'zipfile', '-e', vsixPath, dest], `${candidate} zipfile`);
                return;
            } catch (error) {
                lastError = error;
                if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
                    throw error;
                }
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error('No Python runtime available to extract VSIX');
    }

    private async extractArchive(vsixPath: string, dest: string): Promise<void> {
        fs.mkdirSync(dest, { recursive: true });

        if (process.platform === 'win32') {
            await this.runCommand('powershell.exe', [
                '-NoProfile',
                '-Command',
                `Expand-Archive -LiteralPath '${vsixPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
            ], 'Expand-Archive');
            return;
        }

        await this.extractWithPython(vsixPath, dest);
    }

    private loadManifest(extractedDir: string): { manifest: ExtensionManifest; manifestPath: string } {
        const manifestCandidates = [
            path.join(extractedDir, 'extension', 'package.json'),
            path.join(extractedDir, 'package.json'),
        ];

        for (const candidate of manifestCandidates) {
            if (fs.existsSync(candidate)) {
                return {
                    manifest: JSON.parse(fs.readFileSync(candidate, 'utf8')) as ExtensionManifest,
                    manifestPath: candidate,
                };
            }
        }

        throw new Error('package.json not found in VSIX');
    }

    public async installFromOpenVsx(publisher: string, name: string, version?: string): Promise<ExtensionRecord> {
        const meta = await this.openVsxClient.getExtensionMeta(publisher, name, version);
        const resolvedVersion = meta.version;
        const downloadUrl = meta.files?.download;
        if (!downloadUrl) throw new Error('No download URL in OpenVSX metadata');

        const extId = `${publisher}.${name}`;
        const extensionsRoot = resolveExtensionStorageRoot();
        const packageDir = path.join(extensionsRoot, 'packages');
        const extractedBase = path.join(extensionsRoot, 'extracted');
        fs.mkdirSync(packageDir, { recursive: true });
        fs.mkdirSync(extractedBase, { recursive: true });

        const vsixPath = path.join(packageDir, `${extId}-${resolvedVersion}.vsix`);
        const extractedDir = path.join(extractedBase, `${extId}-${resolvedVersion}`);

        const bytes = await this.openVsxClient.downloadVsix(downloadUrl);
        fs.writeFileSync(vsixPath, bytes);

        if (fs.existsSync(extractedDir)) {
            fs.rmSync(extractedDir, { recursive: true, force: true });
        }
        await this.extractArchive(vsixPath, extractedDir);

        const { manifest, manifestPath } = this.loadManifest(extractedDir);

        const now = new Date().toISOString();
        return {
            id: `${manifest.publisher}.${manifest.name}`,
            publisher: manifest.publisher,
            name: manifest.name,
            version: manifest.version,
            installPath: extractedDir,
            manifestPath,
            enabled: true,
            installedAt: now,
            updatedAt: now,
            source: 'openvsx',
            manifest,
        };
    }
}
