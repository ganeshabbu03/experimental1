import { type ReactNode } from 'react';
import { type FileNode } from '@/stores/useFileStore';
import { useOutputStore } from '@/stores/useOutputStore';

// Piston API Configuration
const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';

// Language Mapping for Piston
const EXTENSION_MAP: Record<string, { language: string, version: string }> = {
    'java': { language: 'java', version: '15.0.2' },
    'py': { language: 'python', version: '3.10.0' },
    'cpp': { language: 'c++', version: '10.2.0' },
    'c': { language: 'c', version: '10.2.0' },
    'go': { language: 'go', version: '1.16.2' },
    'rs': { language: 'rust', version: '1.68.2' },
    'php': { language: 'php', version: '8.2.3' },
    'rb': { language: 'ruby', version: '3.0.1' },
    'js': { language: 'javascript', version: '18.15.0' },
    'ts': { language: 'typescript', version: '5.0.3' },
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
                    log: (...args: any[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span>{output}</span>, output, 'stdout');
                    },
                    error: (...args: any[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-red-400">{output}</span>, output, 'stderr');
                    },
                    warn: (...args: any[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-yellow-400">{output}</span>, output, 'info');
                    },
                    info: (...args: any[]) => {
                        const output = args.map(a => String(a)).join(' ');
                        writeOutput(<span className="text-blue-400">{output}</span>, output, 'info');
                    }
                };

                if (isBrowserTS) {
                    writeOutput(<span className="text-yellow-500 mb-1 block opacity-70 italic">Note: Browser execution of TypeScript/JSX is experimental. Import stripping active.</span>, 'Note: Browser execution of TypeScript/JSX is experimental. Import stripping active.', 'info');
                }

                try {
                    // Stripping imports/exports for simple execution (very basic)
                    let executableContent = content
                        .replace(/import\s+.*from\s+['"].*['"];?/g, '')
                        .replace(/export\s+default\s+/g, '')
                        .replace(/export\s+/g, '');

                    const runFunc = new Function('console', executableContent);
                    runFunc(safeConsole);

                    writeOutput(<span className="text-green-500 opacity-50 mt-1 block">✓ Execution finished</span>, '✓ Execution finished', 'success');

                } catch (err: any) {
                    writeOutput(<span className="text-red-500 group"><span className="font-bold">Runtime Error:</span> {err.message}</span>, `Runtime Error: ${err.message}`, 'error');
                }
            } else {
                // Use Piston for everything else (Java, Python, C++, etc.)
                await runService.executeWithPiston(file, content, stdin);
            }
        } catch (e: any) {
            writeOutput(<span className="text-red-500">System Error: {e.message}</span>, `System Error: ${e.message}`, 'error');
        }
    },

    executeWithPiston: async (file: FileNode, content: string, stdin?: string) => {
        const { addLine } = useOutputStore.getState();

        // Helper to write to both terminal and output
        const writeOutput = (_terminalContent: ReactNode, outputText: string, outputType: 'stdout' | 'stderr' | 'info' | 'success' | 'error' = 'stdout') => {
            addLine(outputText, outputType);
        };

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const runtime = EXTENSION_MAP[ext];

        if (!runtime) {
            writeOutput(<span className="text-yellow-500">Execution not supported for <strong>.{ext}</strong> files.</span>, `Execution not supported for .${ext} files.`, 'error');
            return;
        }

        writeOutput(<span className="text-gray-400 italic">Sending to Piston ({runtime.language} v{runtime.version})...</span>, `Sending to Piston (${runtime.language} v${runtime.version})...`, 'info');

        // Pre-process content to improve success rate
        let processedContent = content;

        // Java: Strip package declarations and fix class name mismatches
        if (runtime.language === 'java') {
            if (processedContent.includes('package ')) {
                writeOutput(<span className="text-yellow-500 opacity-60 text-xs">Info: Stripping 'package' declaration for remote execution.</span>, "Info: Stripping 'package' declaration for remote execution.", 'info');
                processedContent = processedContent.replace(/^\s*package\s+[\w.]+;/gm, '// package stripped by runService');
            }

            // Try to find the class with main method and rename it to match filename
            const expectedClassName = file.name.replace('.java', '');
            const mainMethodRegex = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*\w+\s*\)/;

            // Find all public class declarations
            const classMatches = processedContent.matchAll(/public\s+class\s+(\w+)/g);
            let mainClassName = null;

            for (const match of classMatches) {
                const className = match[1];
                // Check if this class has a main method
                const classStartIndex = match.index!;
                const classContent = processedContent.substring(classStartIndex);

                if (mainMethodRegex.test(classContent)) {
                    mainClassName = className;
                    break;
                }
            }

            // If we found a main class and it doesn't match the filename, rename it
            if (mainClassName && mainClassName !== expectedClassName) {
                writeOutput(<span className="text-yellow-500 opacity-60 text-xs">Info: Renaming class '{mainClassName}' to '{expectedClassName}' to match filename.</span>, `Info: Renaming class '${mainClassName}' to '${expectedClassName}' to match filename.`, 'info');
                // Replace the class name (be careful to only replace the class declaration, not other occurrences)
                processedContent = processedContent.replace(
                    new RegExp(`(public\\s+class\\s+)${mainClassName}\\b`, 'g'),
                    `$1${expectedClassName}`
                );
            }
        }

        try {
            const response = await fetch(PISTON_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: runtime.language,
                    version: runtime.version,
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
                throw new Error(`API Request Failed: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle compilation output (if any)
            if (data.compile && data.compile.output) {
                writeOutput(<span className="text-yellow-400 whitespace-pre-wrap block mb-2">{data.compile.output}</span>, data.compile.output, 'info');
            }

            // Handle run output
            if (data.run) {
                const output = data.run.output || '';
                const isError = (data.run.stderr && data.run.stderr.length > 0) || (data.run.code !== 0);

                if (output.trim()) {
                    writeOutput(<span className={`${isError ? 'text-red-400' : 'text-[var(--text-primary)]'} whitespace-pre-wrap block`}>{output}</span>, output, isError ? 'stderr' : 'stdout');
                } else if (!data.compile?.output) {
                    writeOutput(<span className="text-gray-500 italic block">No output returned.</span>, 'No output returned.', 'info');
                }
            }

            writeOutput(<span className="text-green-500 opacity-50 mt-1 block">✓ Remote Execution finished</span>, '✓ Remote Execution finished', 'success');

        } catch (err: any) {
            writeOutput(<span className="text-red-500 block"><span className="font-bold">API Error:</span> {err.message}</span>, `API Error: ${err.message}`, 'error');
        }
    }
};
