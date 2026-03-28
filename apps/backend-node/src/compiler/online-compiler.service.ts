import { Injectable } from '@nestjs/common';
import * as path from 'path';

type PistonRuntime = {
    language: string;
    version: string;
    aliases?: string[];
};

type PistonExecuteResponse = {
    compile?: {
        stdout?: string;
        stderr?: string;
        output?: string;
        code?: number;
        signal?: string | null;
    };
    run?: {
        stdout?: string;
        stderr?: string;
        output?: string;
        code?: number;
        signal?: string | null;
    };
    message?: string;
};

export type OnlineCompilerExecutionResult = {
    handled: boolean;
    shouldFallback: boolean;
    success: boolean;
    language?: string;
    version?: string;
    compileOutput?: string;
    runOutput?: string;
    exitCode?: number | null;
    error?: string;
};

@Injectable()
export class OnlineCompilerService {
    private readonly baseUrl = (process.env.ONLINE_COMPILER_BASE_URL || 'https://emkc.org/api/v2/piston').replace(/\/+$/, '');
    private readonly executePath = process.env.ONLINE_COMPILER_EXECUTE_PATH || '/execute';
    private readonly runtimesPath = process.env.ONLINE_COMPILER_RUNTIMES_PATH || '/runtimes';
    private readonly timeoutMs = Number.parseInt(process.env.ONLINE_COMPILER_TIMEOUT_MS || '20000', 10) || 20000;
    private readonly runtimesCacheMs = Number.parseInt(process.env.ONLINE_COMPILER_RUNTIMES_CACHE_MS || '900000', 10) || 900000;

    private runtimesCache: PistonRuntime[] = [];
    private runtimesCacheAt = 0;
    private runtimesPromise: Promise<PistonRuntime[]> | null = null;

    private readonly extensionLanguageMap: Record<string, string[]> = {
        c: ['c'],
        cc: ['c++', 'cpp'],
        cpp: ['c++', 'cpp'],
        cxx: ['c++', 'cpp'],
        hpp: ['c++', 'cpp'],
        cs: ['csharp', 'c#', 'dotnet'],
        fs: ['fsharp'],
        fsx: ['fsharp'],
        go: ['go', 'golang'],
        java: ['java'],
        jl: ['julia'],
        js: ['javascript', 'node'],
        jsx: ['javascript'],
        kt: ['kotlin'],
        kts: ['kotlin'],
        lua: ['lua'],
        nim: ['nim'],
        php: ['php'],
        pl: ['perl'],
        ps1: ['powershell', 'pwsh'],
        py: ['python', 'py'],
        rb: ['ruby'],
        rs: ['rust'],
        r: ['r'],
        scala: ['scala'],
        sh: ['bash', 'sh'],
        sql: ['sqlite3', 'sql'],
        swift: ['swift'],
        ts: ['typescript'],
        tsx: ['typescript'],
        vb: ['vb', 'visualbasic'],
        zig: ['zig'],
    };

    public async executeFile(filename: string, content: string, stdin: string = ''): Promise<OnlineCompilerExecutionResult> {
        const runtime = await this.resolveRuntimeForFilename(filename);
        if (!runtime) {
            return {
                handled: false,
                shouldFallback: true,
                success: false,
            };
        }

        try {
            const response = await this.fetchJson<PistonExecuteResponse>(
                `${this.baseUrl}${this.executePath}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        language: runtime.language,
                        version: runtime.version,
                        files: [{ name: path.basename(filename), content }],
                        stdin,
                    }),
                },
            );

            const compileOutput = response.compile?.output || this.mergeStreams(response.compile?.stdout, response.compile?.stderr);
            const runOutput = response.run?.output || this.mergeStreams(response.run?.stdout, response.run?.stderr);
            const exitCode = typeof response.run?.code === 'number' ? response.run.code : null;
            const success = exitCode === 0;

            return {
                handled: true,
                shouldFallback: false,
                success,
                language: runtime.language,
                version: runtime.version,
                compileOutput: compileOutput || undefined,
                runOutput: runOutput || undefined,
                exitCode,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                handled: true,
                shouldFallback: true,
                success: false,
                language: runtime.language,
                version: runtime.version,
                error: `Online compiler unavailable: ${message}`,
            };
        }
    }

    private mergeStreams(stdout?: string, stderr?: string): string {
        const chunks = [stdout || '', stderr || ''].filter((chunk) => chunk.trim().length > 0);
        return chunks.join('\n');
    }

    private async resolveRuntimeForFilename(filename: string): Promise<PistonRuntime | null> {
        const runtimes = await this.getRuntimes();
        if (runtimes.length === 0) {
            return null;
        }

        const byAlias = new Map<string, PistonRuntime[]>();
        for (const runtime of runtimes) {
            const keys = [runtime.language, ...(runtime.aliases || [])]
                .map((value) => this.normalizeToken(value))
                .filter((value) => value.length > 0);

            for (const key of keys) {
                const list = byAlias.get(key) || [];
                list.push(runtime);
                byAlias.set(key, list);
            }
        }

        const extension = path.extname(filename).replace(/^\./, '').toLowerCase();
        const candidates = new Set<string>();
        if (extension) {
            const mapped = this.extensionLanguageMap[extension] || [];
            for (const item of mapped) candidates.add(item);
            candidates.add(extension);
        }

        for (const candidate of candidates) {
            const key = this.normalizeToken(candidate);
            const matches = byAlias.get(key);
            if (matches && matches.length > 0) {
                return this.pickBestRuntime(matches);
            }
        }

        return null;
    }

    private pickBestRuntime(runtimes: PistonRuntime[]): PistonRuntime {
        const sorted = [...runtimes].sort((a, b) => this.compareVersionsDesc(a.version, b.version));
        return sorted[0];
    }

    private compareVersionsDesc(left: string, right: string): number {
        const a = this.parseVersion(left);
        const b = this.parseVersion(right);
        const max = Math.max(a.length, b.length);
        for (let i = 0; i < max; i += 1) {
            const av = a[i] || 0;
            const bv = b[i] || 0;
            if (av !== bv) return bv - av;
        }
        return right.localeCompare(left);
    }

    private parseVersion(value: string): number[] {
        return value
            .split(/[^0-9]+/)
            .filter((part) => part.length > 0)
            .map((part) => Number.parseInt(part, 10))
            .filter((part) => Number.isFinite(part));
    }

    private normalizeToken(value: string): string {
        return value.trim().toLowerCase();
    }

    private async getRuntimes(): Promise<PistonRuntime[]> {
        const now = Date.now();
        if (this.runtimesCache.length > 0 && now - this.runtimesCacheAt < this.runtimesCacheMs) {
            return this.runtimesCache;
        }

        if (this.runtimesPromise) {
            return this.runtimesPromise;
        }

        this.runtimesPromise = this.fetchJson<PistonRuntime[]>(`${this.baseUrl}${this.runtimesPath}`)
            .then((runtimes) => {
                this.runtimesCache = Array.isArray(runtimes) ? runtimes : [];
                this.runtimesCacheAt = Date.now();
                return this.runtimesCache;
            })
            .catch((error) => {
                console.error('[OnlineCompiler] Failed to fetch runtimes:', error);
                return [];
            })
            .finally(() => {
                this.runtimesPromise = null;
            });

        return this.runtimesPromise;
    }

    private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return (await response.json()) as T;
        } finally {
            clearTimeout(timeout);
        }
    }
}

