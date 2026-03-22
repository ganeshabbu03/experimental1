import React, { useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { X, FileCode, Play } from 'lucide-react';
import { useFileStore } from '@/stores/useFileStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTerminalStore } from '@/stores/useTerminalStore';
import { useParams } from 'react-router-dom';
import { projectService } from '@/services/projectService';
import { cn } from '@/utils/cn';
// Configure Monaco loader to use the CDN
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
    }
});

export default function CodeEditor() {
    const { openFiles, activeFileId, files, closeFile, selectFile, updateFileContent } = useFileStore();
    const { theme } = useThemeStore();
    const { isAIPanelOpen, toggleAIPanel, setTerminalOpen, isTerminalOpen } = useLayoutStore();
    const { sendInput } = useTerminalStore();
    const { projectId } = useParams();
    const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [activeContent, setActiveContent] = React.useState('');
    const [activeLanguage, setActiveLanguage] = React.useState('typescript');

    const handleRun = () => {
        if (!isTerminalOpen) {
            setTerminalOpen(true);
        }

        let runCommand = "npm run dev\\r";

        if (activeLanguage === 'python') {
            const fileName = activeFileId?.split('/').pop() || 'main.py';
            runCommand = `python ${fileName}\\r`;
        } else if (activeLanguage === 'javascript') {
            const fileName = activeFileId?.split('/').pop() || 'index.js';
            runCommand = `node ${fileName}\\r`;
        }

        // Timeout to ensure terminal is mounted/connected if it was just opened
        setTimeout(() => {
            sendInput(runCommand);
        }, 100);
    };

    const findFileContent = (fileId: string) => {
        const find = (nodes: any[]): any => {
            for (const node of nodes) {
                if (node.id === fileId) return node;
                if (node.children) {
                    const found = find(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return find(files);
    };

    useEffect(() => {
        if (activeFileId) {
            const file = findFileContent(activeFileId);
            if (file) {
                setActiveContent(file.content || '');
                if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) setActiveLanguage('typescript');
                else if (file.name.endsWith('.json')) setActiveLanguage('json');
                else if (file.name.endsWith('.css')) setActiveLanguage('css');
                else if (file.name.endsWith('.md')) setActiveLanguage('markdown');
                else setActiveLanguage('plaintext');
            }
        }
    }, [activeFileId, files]);

    return (
        <div className="h-full bg-transparent flex flex-col w-full overflow-hidden">
            {/* Tabs */}
            <div className="h-10 flex bg-transparent overflow-x-auto px-2 pt-2 pb-1 gap-1.5 z-10 relative">
                {openFiles.map((fileId) => {
                    const file = findFileContent(fileId);
                    const isActive = fileId === activeFileId;
                    return (
                        <div
                            key={fileId}
                            className={cn(
                                "editor-tab flex items-center text-[11px] cursor-pointer group select-none px-3 font-medium tracking-wide",
                                isActive
                                    ? "active text-[var(--text-primary)]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
                            )}
                            onClick={() => selectFile(fileId)}
                        >
                            <FileCode className={cn("h-3.5 w-3.5 mr-2", isActive ? "text-orange-500" : "text-[var(--text-tertiary)] group-hover:text-orange-500/50 transition-colors")} />
                            <span className="truncate max-w-[120px]">{file?.name || fileId}</span>
                            <div
                                className={cn(
                                    "ml-2 p-0.5 rounded-md hover:bg-white/10 transition-colors",
                                    !isActive && "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={(e) => { e.stopPropagation(); closeFile(fileId); }}
                            >
                                <X className="h-3 w-3" />
                            </div>
                        </div>
                    );
                })}

                <div className="flex-1" />

                <div className="flex items-center gap-1.5 px-3">
                    {/* Run Button */}
                    <button
                        onClick={handleRun}
                        className="group relative flex items-center justify-center h-8 w-8 transition-all duration-300"
                        title="Run Code"
                    >
                        <div className="absolute inset-0 bg-emerald-500/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
                        <div className="relative h-6 w-6 rounded-full border border-emerald-500/40 group-hover:border-emerald-500 flex items-center justify-center transition-colors duration-300">
                            <Play className="h-2.5 w-2.5 text-emerald-500 fill-emerald-500" />
                        </div>
                    </button>


                    <div className="w-px h-4 bg-[var(--border-muted)] mx-1" />

                    <button
                        id="ai-panel-toggle"
                        onClick={toggleAIPanel}
                        className={cn(
                            "h-8 w-8 transition-all duration-300 flex items-center justify-center rounded-lg",
                            isAIPanelOpen ? "bg-orange-500/10 text-orange-500" : "hover:bg-white/5 text-[var(--text-secondary)]"
                        )}
                        title="Toggle AI Panel"
                    >
                        <img
                            src="/deexenlogo.png"
                            alt="AI Panel"
                            className={cn(
                                "h-3.5 w-3.5 transition-all duration-300",
                                isAIPanelOpen ? "opacity-100" : "opacity-40 grayscale group-hover:opacity-70"
                            )}
                        />
                    </button>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 w-full relative min-h-0">
                {(!activeFileId || openFiles.length === 0) ? (
                    <div className="h-full w-full bg-[#1e1e1e] flex flex-col items-center justify-center text-[var(--text-secondary)]">
                        <FileCode className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">Select a file to start editing</p>
                    </div>
                ) : (
                    <Editor
                        height="100%"
                        language={activeLanguage}
                        value={activeContent}
                        theme={theme === 'dark' ? 'deexen-dark' : 'deexen-light'}
                        onChange={(value) => {
                            if (activeFileId && value !== undefined) {
                                setActiveContent(value);
                                updateFileContent(activeFileId, value);

                                if (projectId && !activeFileId.includes('root') && !activeFileId.includes('project')) {
                                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                                    saveTimeoutRef.current = setTimeout(() => {
                                        projectService.saveFile(projectId, activeFileId, value).catch(err => {
                                            console.error("Failed to auto-save file:", err);
                                        });
                                    }, 1000);
                                }
                            }
                        }}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontLigatures: true,
                            letterSpacing: 0.5,
                            lineHeight: 24,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 16 },
                            lineNumbers: 'on',
                            renderLineHighlight: 'line',
                            cursorBlinking: 'smooth',
                            cursorWidth: 2,
                            smoothScrolling: true,
                        }}
                        beforeMount={(monaco) => {
                            monaco.editor.defineTheme('deexen-dark', {
                                base: 'vs-dark',
                                inherit: true,
                                rules: [
                                    { token: '', background: '00000000' } // Ensure transparent rules
                                ],
                                colors: {
                                    'editor.background': '#00000000', // Transparent
                                    'editor.lineHighlightBackground': '#ffffff05',
                                    'editorGutter.background': '#00000000',
                                    'editorLineNumber.foreground': '#444444',
                                    'editorLineNumber.activeForeground': '#888888',
                                    'editorCursor.foreground': '#f97316',
                                    'editor.selectionBackground': '#f9731630',
                                }
                            });
                            monaco.editor.defineTheme('deexen-light', {
                                base: 'vs',
                                inherit: true,
                                rules: [],
                                colors: {
                                    'editor.background': '#ffffff00',
                                    'editor.lineHighlightBackground': '#00000005',
                                    'editorGutter.background': '#ffffff00',
                                    'editorLineNumber.foreground': '#cccccc',
                                    'editorCursor.foreground': '#f97316',
                                    'editor.selectionBackground': '#f9731630',
                                }
                            });
                        }}
                    />
                )}
            </div>
        </div>
    );
}
