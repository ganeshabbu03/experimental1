import { Injectable } from '@nestjs/common';
import * as path from 'path';

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
    private readonly baseUrl = 'https://api.onecompiler.com/v1/run';
    private readonly timeoutMs = Number.parseInt(process.env.ONLINE_COMPILER_TIMEOUT_MS || '20000', 10) || 20000;
    private readonly apiKey = process.env.ONECOMPILER_API_KEY || 'oc_44hpxmhxm_44hpxmhy7_52b00d3bfe868e5fe31c4537ae7da9a4858798f353e8c004';

    private readonly extensionLanguageMap: Record<string, string> = {
        'c': 'c',
        'cc': 'cpp',
        'cpp': 'cpp',
        'cxx': 'cpp',
        'hpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'java': 'java',
        'js': 'nodejs',
        'jsx': 'nodejs',
        'kt': 'kotlin',
        'kts': 'kotlin',
        'php': 'php',
        'py': 'python',
        'rb': 'ruby',
        'rs': 'rust',
        'sh': 'bash',
        'sql': 'sqlite3',
        'swift': 'swift',
        'ts': 'typescript',
        'tsx': 'typescript',
    };

    public async executeFile(filename: string, content: string, stdin: string = ''): Promise<OnlineCompilerExecutionResult> {
        const language = this.resolveRuntimeForFilename(filename);
        if (!language) {
            return {
                handled: false,
                shouldFallback: true,
                success: false,
            };
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

            let response;
            try {
                response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    body: JSON.stringify({
                        language,
                        files: [{ name: path.basename(filename), content }],
                        stdin,
                    }),
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'success') {
                const runOutput = data.stdout || '';
                const compileOutput = data.stderr || data.exception || '';
                const success = !compileOutput; // OneCompiler combines stderr and exception
                
                return {
                    handled: true,
                    shouldFallback: false,
                    success,
                    language,
                    version: 'latest',
                    compileOutput: compileOutput || undefined,
                    runOutput: runOutput || undefined,
                    exitCode: success ? 0 : 1,
                };
            } else {
                return {
                    handled: true,
                    shouldFallback: false,
                    success: false,
                    language,
                    version: 'latest',
                    error: `Execution failed: ${data.exception || 'Unknown Error'}`,
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                handled: true,
                shouldFallback: true, // Fallback to local execution if API fails
                success: false,
                language,
                version: 'latest',
                error: `Online compiler unavailable: ${message}`,
            };
        }
    }

    private resolveRuntimeForFilename(filename: string): string | null {
        const extension = path.extname(filename).replace(/^\./, '').toLowerCase();
        
        if (this.extensionLanguageMap[extension]) {
            return this.extensionLanguageMap[extension];
        }
        
        const nameWithoutExt = path.basename(filename, path.extname(filename)).toLowerCase();
        if (this.extensionLanguageMap[nameWithoutExt]) {
            return this.extensionLanguageMap[nameWithoutExt];
        }

        return null;
    }
}
