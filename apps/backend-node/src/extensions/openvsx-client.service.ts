import { Injectable } from '@nestjs/common';
import { OpenVsxExtensionMeta } from './contracts';

@Injectable()
export class OpenVsxClientService {
    private base = process.env.OPENVSX_BASE || 'https://open-vsx.org/api';
    private token = process.env.OPENVSX_TOKEN || '';

    private headers(): Record<string, string> {
        const h: Record<string, string> = { Accept: 'application/json' };
        if (this.token) h.Authorization = `Bearer ${this.token}`;
        return h;
    }

    public async getExtensionMeta(publisher: string, name: string, version?: string): Promise<OpenVsxExtensionMeta> {
        const url = version
            ? `${this.base}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
            : `${this.base}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`;

        const res = await fetch(url, { headers: this.headers() as any });
        if (!res.ok) {
            throw new Error(`OpenVSX metadata failed: ${res.status}`);
        }
        return (await res.json()) as OpenVsxExtensionMeta;
    }

    public async downloadVsix(downloadUrl: string): Promise<Buffer> {
        const res = await fetch(downloadUrl, { headers: this.headers() as any });
        if (!res.ok) {
            throw new Error(`OpenVSX VSIX download failed: ${res.status}`);
        }
        const bytes = await res.arrayBuffer();
        return Buffer.from(bytes);
    }
}
