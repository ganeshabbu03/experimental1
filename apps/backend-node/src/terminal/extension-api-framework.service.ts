import { Injectable } from '@nestjs/common';

export type LspSeverity = 'error' | 'warning' | 'info';

export interface LspDiagnosticRule {
    pattern: string;
    message: string;
    severity?: LspSeverity;
}

export interface LspCompletionItem {
    label: string;
    insertText?: string;
    kind?: string;
    detail?: string;
    documentation?: string;
}

export interface LspProviderDefinition {
    language: string;
    diagnostics?: LspDiagnosticRule[];
    completions?: LspCompletionItem[];
}

export interface LspDiagnostic {
    line: number;
    column: number;
    message: string;
    severity: LspSeverity;
}

@Injectable()
export class ExtensionApiFrameworkService {
    private providers = new Map<string, LspProviderDefinition>();

    public registerLspProvider(payload: LspProviderDefinition) {
        const language = String(payload.language || '').toLowerCase().trim();
        if (!language) {
            return { ok: false, error: 'language is required' };
        }

        this.providers.set(language, {
            language,
            diagnostics: payload.diagnostics || [],
            completions: payload.completions || [],
        });

        return { ok: true, language };
    }

    public listProviders() {
        return Array.from(this.providers.keys());
    }

    private getBuiltInProvider(language: string): LspProviderDefinition {
        switch (language) {
            case 'typescript':
            case 'javascript':
                return {
                    language,
                    diagnostics: [
                        { pattern: 'console.log', message: 'Avoid committing debug logging.', severity: 'warning' },
                        { pattern: 'any', message: 'Using any reduces type safety.', severity: 'warning' },
                    ],
                    completions: [
                        { label: 'function', insertText: 'function ${1:name}(${2:args}) {\n  ${3}\n}', kind: 'function' },
                        { label: 'const', insertText: 'const ${1:name} = ${2:value};', kind: 'keyword' },
                    ],
                };
            case 'go':
                return {
                    language,
                    diagnostics: [
                        { pattern: 'fmt.Println(', message: 'Use fmt.Printf when formatting values.', severity: 'info' },
                    ],
                    completions: [
                        { label: 'fmt.Println', insertText: 'fmt.Println(${1:value})', kind: 'function' },
                        { label: 'if err != nil', insertText: 'if err != nil {\n  return err\n}', kind: 'snippet' },
                    ],
                };
            case 'python':
                return {
                    language,
                    diagnostics: [
                        { pattern: 'print(', message: 'Use logging for production code.', severity: 'info' },
                    ],
                    completions: [
                        { label: 'def', insertText: 'def ${1:name}(${2:args}):\n    ${3:pass}', kind: 'function' },
                        { label: 'if __name__ == "__main__"', insertText: 'if __name__ == "__main__":\n    ${1:main()}', kind: 'snippet' },
                    ],
                };
            default:
                return {
                    language,
                    diagnostics: [],
                    completions: [],
                };
        }
    }

    private detectDiagnostics(content: string, rules: LspDiagnosticRule[]): LspDiagnostic[] {
        const diagnostics: LspDiagnostic[] = [];
        const lines = content.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            for (const rule of rules) {
                const pattern = String(rule.pattern || '').trim();
                if (!pattern) continue;

                const idx = lineText.indexOf(pattern);
                if (idx !== -1) {
                    diagnostics.push({
                        line: i + 1,
                        column: idx + 1,
                        message: rule.message,
                        severity: rule.severity || 'warning',
                    });
                }
            }
        }

        return diagnostics;
    }

    public analyze(languageInput: string, content: string) {
        const language = String(languageInput || '').toLowerCase().trim();
        const custom = this.providers.get(language);
        const provider = custom || this.getBuiltInProvider(language);

        const diagnostics = this.detectDiagnostics(content || '', provider.diagnostics || []);

        return {
            language,
            diagnostics,
            completions: provider.completions || [],
            source: custom ? 'extension-provider' : 'builtin-provider',
        };
    }
}
