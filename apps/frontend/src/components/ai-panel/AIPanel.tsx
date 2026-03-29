import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, ChevronUp, Image, FileText, AtSign, ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAIStore } from '@/stores/useAIStore';
import { MODE_CONFIG, AI_MODES } from '@/config/aiModes';
import type { AIMode } from '@/config/aiModes';
import { aiService } from '@/services/aiService';
import { useFileStore, type FileNode } from '@/stores/useFileStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// AI Models
const AI_MODELS = [
    { id: 'opus', name: 'Claude Opus 4.6', suffix: '(Reasoning)' },
    { id: 'sonnet', name: 'Claude Sonnet 4.2', suffix: '' },
    { id: 'gpt4', name: 'GPT-5 Ultra', suffix: '' },
    { id: 'gemini', name: 'Gemini 3 Pro', suffix: '' },
];

const CODE_LIKE_PATTERN = /[`{}();]|=>|\b(const|let|var|function|class|def|import|export|return|if|else|for|while|interface|type|async|await|SELECT|INSERT|UPDATE|DELETE)\b/;

function looksLikeCode(text: string) {
    const value = text.trim();
    if (!value) return false;
    return value.includes('\n') || CODE_LIKE_PATTERN.test(value);
}

function getLanguageFromFilename(filename: string) {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        go: 'go',
        java: 'java',
        rs: 'rust',
        json: 'json',
        css: 'css',
        html: 'html',
        md: 'markdown',
        sql: 'sql',
    };

    return languageMap[extension];
}

function isAIMode(value: string): value is AIMode {
    return value in MODE_CONFIG;
}

function normalizeMarkdown(text: string) {
    return text.replace(/\r\n/g, '\n').trim();
}

export default function AIPanel() {
    const { selectedMode, setMode, isLoading, setLoading, error, setError, response, setResponse, addToHistory } = useAIStore();
    const { activeFileId, files } = useFileStore();

    const [input, setInput] = useState('');
    const [activeModel, setActiveModel] = useState('gemini');
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const config = MODE_CONFIG[selectedMode];
    const currentModel = AI_MODELS.find(m => m.id === activeModel) || AI_MODELS[0];
    const responseConfig = response ? MODE_CONFIG[response.mode] : config;
    const displayedModel = AI_MODELS.find(m => m.id === (response?.model || activeModel)) || currentModel;
    const markdownResponse = response ? normalizeMarkdown(response.response) : '';

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [response]);

    // Close dropdowns on click outside
    useEffect(() => {
        const handler = () => {
            setShowModeDropdown(false);
            setShowModelDropdown(false);
            setShowAddMenu(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    // Resolve the current editor file when the user is asking about open code.
    const getCurrentFile = () => {
        if (!activeFileId) return { content: '', name: '' };
        const findFile = (nodes: FileNode[]): FileNode | null => {
            for (const node of nodes) {
                if (node.id === activeFileId) return node;
                if (node.children) {
                    const found = findFile(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const file = findFile(files);
        return {
            content: file?.content || '',
            name: file?.name || '',
        };
    };

    const resolveAnalysisInput = () => {
        const prompt = input.trim();
        const currentFile = getCurrentFile();
        const promptLooksLikeCode = looksLikeCode(prompt);

        if (promptLooksLikeCode) {
            return {
                code: prompt,
                context: currentFile.name
                    ? `User pasted code into the AI panel while ${currentFile.name} was open.`
                    : 'User pasted code into the AI panel.',
                language: getLanguageFromFilename(currentFile.name),
                sourceLabel: currentFile.name ? `Pasted code (editor open: ${currentFile.name})` : 'Pasted code',
                prompt: '',
            };
        }

        if (currentFile.content.trim()) {
            return {
                code: currentFile.content,
                context: prompt
                    ? `User request about ${currentFile.name || 'the open file'}: ${prompt}`
                    : `Analyze the currently open file${currentFile.name ? ` (${currentFile.name})` : ''}.`,
                language: getLanguageFromFilename(currentFile.name),
                sourceLabel: currentFile.name || 'Open file',
                prompt,
            };
        }

        if (prompt) {
            return {
                code: '',
                context: `User request from AI panel: ${prompt}`,
                language: undefined,
                sourceLabel: 'Prompt only',
                prompt,
            };
        }

        return null;
    };

    const handleAnalyze = async () => {
        const request = resolveAnalysisInput();

        if (!request) {
            setError('Open a file, paste code, or ask a question about the file you are editing.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await aiService.analyzeDetailed(selectedMode, request.code, {
                model: activeModel,
                context: request.context,
                language: request.language,
            });

            const responseMode = isAIMode(result.mode) ? result.mode : selectedMode;

            const responseData = {
                mode: responseMode,
                response: result.response,
                timestamp: Date.now(),
                codeAnalyzed: request.code,
                model: result.model,
                tokens: result.tokens,
                processingTime: result.processingTime,
                prompt: request.prompt || undefined,
                sourceLabel: request.sourceLabel,
            };

            setResponse(responseData);
            addToHistory(responseData);
            setInput('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAnalyze();
        }
    };

    const handleCopy = () => {
        if (response) {
            navigator.clipboard.writeText(response.response);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="h-full flex flex-col bg-transparent backdrop-blur-3xl relative z-10">
            {/* Header */}
            <div className="h-12 flex items-center justify-between px-5 border-b border-[rgba(255,255,255,0.04)] flex-shrink-0">
                <div className="flex items-center space-x-3 group cursor-pointer">
                    <img src="/deexenlogo.png" alt="Deexen AI" className="h-5 opacity-90 group-hover:scale-110 transition-transform duration-500 ease-out" />
                    <span className="text-[13px] font-medium text-[var(--text-primary)] tracking-wide">Deexen AI Assistant</span>
                </div>
            </div>

            {/* Mode Description (Dynamic) */}
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}>
                        <config.Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">{config.label} Mode</h3>
                        <p className="text-xs text-[var(--text-secondary)]">{config.description}</p>
                    </div>
                </div>
            </div>

            {/* Response Area */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="flex space-x-1 mb-3">
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">Analyzing your code...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Empty State */}
                {!response && !isLoading && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-sm text-[var(--text-secondary)] mb-2">{config.placeholder}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                            Click "<span className="text-orange-500">{config.buttonText}</span>" to get started
                        </p>
                    </div>
                )}

                {/* Response Display */}
                {response && !isLoading && (
                    <div>
                        {/* Response Header */}
                        <div className="flex items-center justify-between mb-3">
                            <span
                                className="text-xs px-2 py-1 rounded font-medium flex items-center space-x-1"
                                style={{ backgroundColor: `${responseConfig.color}20`, color: responseConfig.color }}
                            >
                                <responseConfig.Icon className="w-3 h-3" />
                                <span>{responseConfig.label}</span>
                            </span>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center space-x-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                                >
                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="mb-3 space-y-1">
                            {response.prompt && (
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Request: {response.prompt}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                {response.sourceLabel && <span>Source: {response.sourceLabel}</span>}
                                <span>Model: {displayedModel.name}</span>
                                {typeof response.tokens === 'number' && <span>Tokens: {response.tokens}</span>}
                                {typeof response.processingTime === 'number' && response.processingTime > 0 && (
                                    <span>{response.processingTime} ms</span>
                                )}
                            </div>
                        </div>

                        {/* Response Content */}
                        <div className="max-w-none text-[var(--text-primary)]">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2 whitespace-pre-wrap break-words">
                                            {children}
                                        </p>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className="text-[var(--text-primary)] font-semibold">{children}</strong>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc pl-5 mb-2 space-y-1 text-sm text-[var(--text-secondary)]">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm text-[var(--text-secondary)]">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                    pre: ({ children }) => (
                                        <pre className="bg-[#0a0a0a] border border-[var(--border-default)] rounded p-3 my-2 overflow-x-auto">
                                            {children}
                                        </pre>
                                    ),
                                    code: ({ className, children }) => {
                                        const isBlock = typeof className === 'string' && className.includes('language-');
                                        if (!isBlock) {
                                            return (
                                                <code className="text-xs font-mono bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded px-1 py-0.5 text-[var(--text-primary)]">
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return <code className="text-xs text-neutral-300 font-mono">{children}</code>;
                                    },
                                }}
                            >
                                {markdownResponse}
                            </ReactMarkdown>
                        </div>

                        {/* Response Footer */}
                        <div className="mt-4 pt-3 border-t border-[var(--border-default)] flex items-center justify-between">
                            <small className="text-[var(--text-secondary)]">
                                {new Date(response.timestamp).toLocaleTimeString()}
                            </small>
                            <div className="flex items-center space-x-2">
                                <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center space-x-1">
                                    <ThumbsUp className="w-3 h-3" />
                                    <span>Good</span>
                                </button>
                                <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center space-x-1">
                                    <ThumbsDown className="w-3 h-3" />
                                    <span>Bad</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-[rgba(255,255,255,0.04)] flex-shrink-0 bg-[rgba(0,0,0,0.1)] pb-2 backdrop-blur-md">
                {/* Text Input */}
                <div className="p-3">
                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything (Ctrl+L), @ to mention, / for workflows"
                            rows={2}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 pr-20 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/5 resize-none transition-all duration-300 backdrop-blur-sm"
                        />
                        <div className="absolute right-2 bottom-2 flex items-center space-x-1.5">
                            <button className="p-1.5 text-[var(--text-secondary)] hover:text-white transition-colors group">
                                <Mic className="w-4 h-4 group-hover:scale-110 transition-transform duration-500" />
                            </button>
                            <button
                                onClick={handleAnalyze}
                                disabled={isLoading}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all duration-500 group",
                                    !isLoading
                                        ? "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                                        : "bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
                                )}
                            >
                                <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-500" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-3 pb-3">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className={cn(
                            "w-full py-2.5 rounded-xl text-[13px] font-medium transition-all duration-500 flex items-center justify-center space-x-2 border shadow-sm hover:shadow-lg backdrop-blur-md group",
                            isLoading ? "bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] border-transparent" : "hover:border-opacity-50"
                        )}
                        style={{
                            backgroundColor: isLoading ? undefined : `${config.color}15`,
                            color: isLoading ? undefined : config.color,
                            borderColor: isLoading ? undefined : `${config.color}30`
                        }}
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <span className="group-hover:tracking-wide transition-all duration-500">{config.buttonText}</span>
                        )}
                    </button>
                </div>

                {/* Footer Controls */}
                <div className="px-3 pb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {/* Add Button */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowModeDropdown(false);
                                    setShowModelDropdown(false);
                                    setShowAddMenu(!showAddMenu);
                                }}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {showAddMenu && (
                                <div className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                                    <button className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2">
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Add File</span>
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2">
                                        <Image className="w-3.5 h-3.5" />
                                        <span>Add Image</span>
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2">
                                        <AtSign className="w-3.5 h-3.5" />
                                        <span>Mention File</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mode Toggle */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAddMenu(false);
                                    setShowModelDropdown(false);
                                    setShowModeDropdown(!showModeDropdown);
                                }}
                                className="flex items-center space-x-1.5 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                            >
                                <ChevronUp className="w-3 h-3" />
                                <config.Icon className="w-3 h-3" style={{ color: config.color }} />
                                <span>{config.label}</span>
                            </button>
                            {showModeDropdown && (
                                <div className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[220px] z-50">
                                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">AI Mode</div>
                                    {AI_MODES.map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => { setMode(mode.id as AIMode); setShowModeDropdown(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 hover:bg-[var(--bg-surface-hover)] flex items-center space-x-3",
                                                selectedMode === mode.id && "bg-[var(--bg-surface-hover)]"
                                            )}
                                        >
                                            <mode.Icon className="w-3.5 h-3.5" style={{ color: mode.color }} />
                                            <div className="flex-1">
                                                <div className="text-xs text-[var(--text-primary)]">{mode.label}</div>
                                                <div className="text-[9px] text-[var(--text-secondary)]">{mode.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAddMenu(false);
                                    setShowModeDropdown(false);
                                    setShowModelDropdown(!showModelDropdown);
                                }}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                            >
                                <ChevronUp className="w-3 h-3" />
                                <span>{currentModel.name}</span>
                            </button>
                            {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[150px] z-50">
                                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Model</div>
                                    {AI_MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => { setActiveModel(model.id); setShowModelDropdown(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]",
                                                activeModel === model.id && "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                                            )}
                                        >
                                            {model.name} <span className="text-neutral-500">{model.suffix}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

