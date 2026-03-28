import { type ReactNode } from 'react';
import { type FileNode } from '@/stores/useFileStore';
import { useOutputStore } from '@/stores/useOutputStore';

// OneCompiler API Configuration
const ONECOMPILER_API_URL = 'https://api.onecompiler.com/v1/run';

// Map extensions or common names to OneCompiler language identifiers
const LANGUAGE_MAP: Record<string, string> = {
    'java': 'java',
    'py': 'python',
    'python': 'python',
    'cpp': 'cpp', 'cxx': 'cpp', 'cc': 'cpp',
    'c': 'c',
    'go': 'go',
    'rs': 'rust',
    'rust': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'ruby': 'ruby',
    'js': 'nodejs', 'javascript': 'nodejs',
    'ts': 'typescript',
    'cs': 'csharp', 'csharp': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin', 'kotlin': 'kotlin',
    'sh': 'bash', 'bash': 'bash',
    'sql': 'sqlite3'
};

export const getCompilerLanguage = (extOrName: string): string | null => {
    return LANGUAGE_MAP[extOrName.toLowerCase()] || null;
};

export const runService = {
    runCode: async (file: FileNode, activeFileContent?: string, stdin?: string) => {
        const { addLine, clear } = useOutputStore.getState();
        const content = activeFileContent || file.content || '';

        // Clear previous output
        clear();

        // Helper to write to both terminal and output
        const writeOutput = (_terminalContent: ReactNode, outputText: string, outputType: 'stdout' | 'stderr' | 'info' | 'success' | 'error' = 'stdout') => {
            addLine(outputText, outputType);
        };

        writeOutput(<span>Running <span className="text-blue-400">{file.name}</span>...</span>, `Running ${file.name}...`, 'info');

        // Simple delay to simulate startup
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const name = file.name.toLowerCase();
            // Browser-native execution (Mock/Limited)
            const isBrowserJS = name.endsWith('.js') || name.endsWith('.mjs');
            const isBrowserTS = name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.jsx');

            // Quick browser execution for simple JS/TS (preserves existing fast functionality)
            // But we can fallback to Piston if needed. For now, let's keep browser exec for these
            // UNLESS user strictly wants backend execution. 
            // NOTE: The user asked for "Java... implement all program files".
            // We will stick to browser exec for JS/TS for speed, but use Piston for others.

            if (isBrowserJS || isBrowserTS) {
                // Prepare a safe console environment
                const safeConsole = {
                    log: (...args: unknown[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span>{output}</span>, output, 'stdout');
                    },
                    error: (...args: unknown[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-red-400">{output}</span>, output, 'stderr');
                    },
                    warn: (...args: unknown[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-yellow-400">{output}</span>, output, 'info');
                    },
                    info: (...args: unknown[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-blue-400">{output}</span>, output, 'info');
                    }
                };

                if (isBrowserTS) {
                    writeOutput(<span className="text-yellow-500 mb-1 block opacity-70 italic">Note: Browser execution of TypeScript/JSX is experimental. Import stripping active.</span>, 'Note: Browser execution of TypeScript/JSX is experimental. Import stripping active.', 'info');
                }

                try {
                    // Stripping imports/exports for simple execution (very basic)
                    const executableContent = content
                        .replace(/import\s+.*from\s+['"].*['"];?/g, '')
                        .replace(/export\s+default\s+/g, '')
                        .replace(/export\s+/g, '');

                    const runFunc = new Function('console', executableContent);
                    runFunc(safeConsole);

                    writeOutput(<span className="text-green-500 opacity-50 mt-1 block">✓ Execution finished</span>, '✓ Execution finished', 'success');

                } catch (e) {
                    const err = e as Error;
                    writeOutput(<span className="text-red-500 group"><span className="font-bold">Runtime Error:</span> {err.message}</span>, `Runtime Error: ${err.message}`, 'error');
                }
            } else {
                // Use OneCompiler for everything else (Java, Python, C++, etc.)
                await runService.executeWithOneCompiler(file, content, stdin);
            }
        } catch (rawError) {
            const e = rawError as Error;
            writeOutput(<span className="text-red-500">System Error: {e.message}</span>, `System Error: ${e.message}`, 'error');
        }
    },

    executeWithOneCompiler: async (file: FileNode, content: string, stdin?: string) => {
        const { addLine } = useOutputStore.getState();

        const writeOutput = (_terminalContent: ReactNode, outputText: string, outputType: 'stdout' | 'stderr' | 'info' | 'success' | 'error' = 'stdout') => {
            addLine(outputText, outputType);
        };

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const languageId = getCompilerLanguage(ext) || getCompilerLanguage(file.name);

        if (!languageId) {
            writeOutput(<span className="text-yellow-500">Execution not supported for <strong>.{ext}</strong> files.</span>, `Execution not supported for .${ext} files.`, 'error');
            return;
        }

        writeOutput(<span className="text-gray-400 italic">Sending to OneCompiler ({languageId})...</span>, `Sending to OneCompiler (${languageId})...`, 'info');

        let processedContent = content;

        if (languageId === 'java') {
            if (processedContent.includes('package ')) {
                writeOutput(<span className="text-yellow-500 opacity-60 text-xs">Info: Stripping 'package' declaration for remote execution.</span>, "Info: Stripping 'package' declaration for remote execution.", 'info');
                processedContent = processedContent.replace(/^\s*package\s+[\w.]+;/gm, '// package stripped by runService');
            }

            const expectedClassName = file.name.replace('.java', '');
            const mainMethodRegex = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*\w+\s*\)/;
            const classMatches = processedContent.matchAll(/public\s+class\s+(\w+)/g);
            let mainClassName = null;

            for (const match of classMatches) {
                const className = match[1];
                const classStartIndex = match.index!;
                const classContent = processedContent.substring(classStartIndex);

                if (mainMethodRegex.test(classContent)) {
                    mainClassName = className;
                    break;
                }
            }

            if (mainClassName && mainClassName !== expectedClassName) {
                writeOutput(<span className="text-yellow-500 opacity-60 text-xs">Info: Renaming class '{mainClassName}' to '{expectedClassName}' to match filename.</span>, `Info: Renaming class '${mainClassName}' to '${expectedClassName}' to match filename.`, 'info');
                processedContent = processedContent.replace(
                    new RegExp(`(public\\s+class\\s+)${mainClassName}\\b`, 'g'),
                    `$1${expectedClassName}`
                );
            }
        }

        try {
            const response = await fetch(ONECOMPILER_API_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_ONECOMPILER_API_KEY || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: JSON.stringify({
                    language: languageId,
                    files: [
                        {
                            name: file.name,
                            content: processedContent
                        }
                    ],
                    stdin: stdin || ''
                })
            });

            if (!response.ok) {
                throw new Error(`API Request Failed: ${response.statusText} (${response.status})`);
            }

            const data = await response.json();

            // Handle run output
            if (data.status === 'success') {
                const output = data.stdout || '';
                const errorOutput = data.stderr || data.exception || '';

                if (errorOutput) {
                    writeOutput(<span className="text-red-400 whitespace-pre-wrap block mb-2">{errorOutput}</span>, errorOutput, 'stderr');
                }

                if (output.trim()) {
                    writeOutput(<span className="text-[var(--text-primary)] whitespace-pre-wrap block">{output}</span>, output, 'stdout');
                } else if (!errorOutput) {
                    writeOutput(<span className="text-gray-500 italic block">No output returned.</span>, 'No output returned.', 'info');
                }
            } else {
                writeOutput(<span className="text-red-400 whitespace-pre-wrap block mb-2">Execution failed: {data.exception || 'Unknown Error'}</span>, `Execution failed: ${data.exception || 'Unknown Error'}`, 'stderr');
            }

            writeOutput(<span className="text-green-500 opacity-50 mt-1 block">✓ Remote Execution finished</span>, '✓ Remote Execution finished', 'success');

        } catch (rawErr) {
            const err = rawErr as Error;
            writeOutput(<span className="text-red-500 block"><span className="font-bold">API Error:</span> {err.message}</span>, `API Error: ${err.message}`, 'error');
        }
    }
};
