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

    private async extractArchive(vsixPath: string, dest: string): Promise<void> {
        fs.mkdirSync(dest, { recursive: true });

        if (process.platform === 'win32') {
            await new Promise<void>((resolve, reject) => {
                const p = spawn('powershell.exe', [
                    '-NoProfile',
                    '-Command',
                    `Expand-Archive -LiteralPath '${vsixPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
                ], { stdio: 'ignore' });
                p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive failed (${code})`)));
                p.on('error', reject);
            });
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const p = spawn('unzip', ['-o', vsixPath, '-d', dest], { stdio: 'ignore' });
            p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`unzip failed (${code})`)));
            p.on('error', reject);
        });
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
