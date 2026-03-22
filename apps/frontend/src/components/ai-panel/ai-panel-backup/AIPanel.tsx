import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Mic, ChevronUp, Image, FileText, AtSign, History, MessageSquarePlus, Trash2, X, CheckCircle2, Volume2, GraduationCap } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAIStore } from '@/stores/useAIStore';
import { MODE_CONFIG, AI_MODES } from '@/config/aiModes';
import type { AIMode } from '@/config/aiModes';
import { aiService } from '@/services/aiService';
import { useFileStore } from '@/stores/useFileStore';

// AI Models
// AI Models
const AI_MODELS = [
    { id: 'gemini', name: 'Gemini 2.5 Flash', suffix: '' },
    { id: 'gpt-4o', name: 'GPT-4o', suffix: '' },
    { id: 'moonshot-k2', name: 'Kimi K2 Thinking', suffix: '(Thinking)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', suffix: '(Thinking)' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3.5 Sonnet', suffix: '' },
    { id: 'magicoder', name: 'Magicoder 7B', suffix: '(Local)' },
    { id: 'llama3-8b', name: 'Llama 3 8B', suffix: '(Local)' },
];

// Format response with code blocks
function formatResponse(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/);

    return parts.map((part, idx) => {
        if (part.startsWith('```')) {
            const lines = part.replace(/```/g, '').trim().split('\n');
            const lang = lines[0].match(/^[a-z]+$/i) ? lines.shift() : '';
            const code = lines.join('\n');
            return (
                <div key={idx} className="relative group my-4">
                    {lang && (
                        <div className="absolute right-3 top-3 text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            {lang}
                        </div>
                    )}
                    <pre className="bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded p-3 overflow-x-auto selection:bg-orange-500/30">
                        <code className="text-xs text-neutral-300 font-mono leading-relaxed">{code}</code>
                    </pre>
                </div>
            );
        } else {
            // Parse bold text
            const formatted = part.split(/(\*\*.*?\*\*)/).map((segment, i) => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return <strong key={i} className="text-[var(--text-primary)]">{segment.slice(2, -2)}</strong>;
                }
                return segment;
            });
            return part.trim() ? (
                <p key={idx} className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
                    {formatted}
                </p>
            ) : null;
        }
    });
}

// Helper to flatten files for mention list
const getAllFiles = (nodes: any[]): any[] => {
    let allFiles: any[] = [];
    for (const node of nodes) {
        if (node.type === 'file') {
            allFiles.push(node);
        }
        if (node.children) {
            allFiles = [...allFiles, ...getAllFiles(node.children)];
        }
    }
    return allFiles;
};

export default function AIPanel() {
    const {
        selectedMode, setMode, selectedModel, setModel, isLoading, setLoading,
        error, setError,
        conversations, currentConversationId, messages, loadConversations, createConversation, selectConversation, deleteConversation, addMessage
    } = useAIStore();
    const { activeFileId, files } = useFileStore();

    const [input, setInput] = useState('');
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
    const [showSkillDropdown, setShowSkillDropdown] = useState(false);

    // Live Fix State
    const [pendingFix, setPendingFix] = useState<{ original: string; new: string; } | null>(null);

    useEffect(() => {
        loadConversations();
    }, []);

    // Mention state
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognition = useRef<any>(null); // Type as any for now since SpeechRecognition types might be missing

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognition.current = new SpeechRecognition();
            recognition.current.continuous = false;
            recognition.current.interimResults = false;
            recognition.current.lang = 'en-US';

            recognition.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput((prev) => prev + (prev ? ' ' : '') + transcript);
                setIsListening(false);
            };

            recognition.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognition.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognition.current?.stop();
        } else {
            recognition.current?.start();
            setIsListening(true);
        }
    };

    const speakText = useCallback((text: string) => {
        if ('speechSynthesis' in window) {
            // Cancel any current speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            setIsSpeaking(true);
            window.speechSynthesis.speak(utterance);
        }
    }, []);

    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const config = MODE_CONFIG[selectedMode];
    const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];
    const allFiles = getAllFiles(files);

    const filteredFiles = allFiles.filter(f =>
        f.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!showMentions) {
            setMentionIndex(0);
            setMentionQuery('');
        }
    }, [showMentions]);

    // Close dropdowns on click outside
    useEffect(() => {
        const handler = () => {
            setShowMentions(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    // Get current file content
    const getCurrentCode = (): { content: string; name: string } => {
        if (!activeFileId) return { content: '', name: '' };
        const findFile = (nodes: any[]): any => {
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
        return { content: file?.content || '', name: file?.name || '' };
    };

    // Helper to detect language
    const getLanguage = (filename: string): string => {
        if (!filename) return 'javascript';
        const ext = filename.split('.').pop()?.toLowerCase();
        const map: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown'
        };
        return map[ext || ''] || 'text';
    };

    const handleAnalyze = async () => {
        let code = input.trim();
        let language = 'text';

        // 1. Check for file mentions in input (e.g. @filename)
        const mentionMatch = input.match(/@([a-zA-Z0-9_\-\.]+)/);
        if (mentionMatch) {
            const filename = mentionMatch[1];
            const file = allFiles.find(f => f.name === filename);

            if (file) {
                language = getLanguage(file.name);
                // Append file content to the user's prompt
                code = `${input}\n\n// Content of ${file.name}:\n${file.content}`;
            } else {
                // Mentioned file not found, treat as text
            }
        }
        // 2. If no input (or only whitespace), use active file
        else if (!code) {
            const currentFile = getCurrentCode();
            if (currentFile.content) {
                code = currentFile.content;
                language = getLanguage(currentFile.name);
            }
        }
        // 3. Input exists but no mention -> Treat as raw text/code input
        // (Default behavior maintained)

        if (!code) {
            setError('Please write some code first or type a question');
            return;
        }

        setLoading(true);
        setError(null);
        setPendingFix(null);

        // Optimistic UI updates
        // const userMsg = { role: 'user', content: code, created_at: new Date().toISOString() };
        // We need to handle this via store to keep UI in sync or just rely on re-fetch?
        // Ideally optimistic update.

        try {
            // 1. Create conversation if none exists
            let convId = currentConversationId;
            if (!convId) {
                const newConv = await createConversation(code.slice(0, 30));
                convId = newConv.id;
            }

            // 2. Add user message (Optimistically handled by store if we had addMessage action updating local state too, but here we just call API)
            // We can manually add to 'messages' in store if we want instant feedback, but let's assume 'addMessage' does it?
            // The store has 'addMessage' but it updates local state using ChatMessage type.
            // Our aiService.addMessage returns Message object.
            // Let's use the local 'addMessage' action to show it immediately.

            addMessage({
                id: Date.now().toString(),
                role: 'user',
                text: code,
                timestamp: Date.now()
            });

            // 3. Send to backend (User message)
            await aiService.addMessage(convId!, 'user', code); // Ignore return for now

            // 4. Analyze
            const result = await aiService.analyze(selectedMode, selectedModel, code, undefined, language, skillLevel);

            // 5. Add assistant message (UI)
            addMessage({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: result,
                timestamp: Date.now()
            });

            // Voice Feedback (if enabled or just always for now as requested)
            // Stripping code blocks for speech is better
            const speechText = result.replace(/```[\s\S]*?```/g, 'Code block skipped.').replace(/\*\*/g, '');
            speakText(speechText);

            // 6. Send to backend (Assistant message)
            await aiService.addMessage(convId!, 'assistant', result);

            // 7. Live Fix Logic
            if (selectedMode === 'livefix') {
                // Robust extraction using indexOf to find the FIRST code block
                const startIdx = result.indexOf('```');
                if (startIdx !== -1) {
                    const contentStart = result.indexOf('\n', startIdx);
                    // If no newline after first ```, start right after ``` (length 3)
                    const actualStart = (contentStart !== -1 && contentStart < startIdx + 20) ? contentStart + 1 : startIdx + 3;

                    const endIdx = result.lastIndexOf('```');

                    if (endIdx > actualStart) {
                        let fixedCode = result.substring(actualStart, endIdx).trim();
                        // Double check we didn't capture the language identifier if newline logic failed
                        if (fixedCode.startsWith('python') || fixedCode.startsWith('typescript') || fixedCode.startsWith('ts') || fixedCode.startsWith('js')) {
                            const nextLine = fixedCode.indexOf('\n');
                            if (nextLine !== -1) fixedCode = fixedCode.substring(nextLine + 1);
                        }

                        setPendingFix({
                            original: getCurrentCode().content,
                            new: fixedCode
                        });
                    }
                }
            }

            setInput('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };


    const insertMention = (filename: string) => {
        const cursorPos = input.lastIndexOf('@');
        if (cursorPos === -1) return;

        const prefix = input.substring(0, cursorPos);
        const newInput = prefix + '@' + filename + ' ';
        setInput(newInput);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInput(value);

        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const query = value.slice(lastAtIndex + 1);
            // Only show if no spaces after @ (simple logic)
            if (!query.includes(' ')) {
                setMentionQuery(query);
                if (!showMentions) {
                    setShowMentions(true);
                }
                return;
            }
        }
        setShowMentions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredFiles.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredFiles[mentionIndex]) {
                    insertMention(filteredFiles[mentionIndex].name);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentions(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAnalyze();
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-canvas)]">
            {/* Header */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border-default)] flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <img src="/deexenlogo.png" alt="Deexen AI" className="h-5" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">AI</span>
                </div>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => createConversation()}
                        title="New Chat"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        title="History"
                        className={cn(
                            "p-1.5 rounded transition-colors",
                            showHistory ? "text-[var(--text-primary)] bg-[var(--bg-surface-hover)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                        )}
                    >
                        {showHistory ? <X className="w-4 h-4" /> : <History className="w-4 h-4" />}
                    </button>
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
            {/* Response Area or History */}
            <div className="flex-1 overflow-y-auto p-4 relative">
                {showHistory ? (
                    <div className="absolute inset-0 bg-[var(--bg-canvas)] p-4 overflow-y-auto z-10">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Recent Conversations</h3>
                        <div className="space-y-2">
                            {conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={cn(
                                        "group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                                        currentConversationId === conv.id
                                            ? "bg-[var(--bg-surface)] border-orange-500/50"
                                            : "bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-orange-500/30"
                                    )}
                                    onClick={() => { selectConversation(conv.id); setShowHistory(false); }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{conv.title || "New Conversation"}</div>
                                        <div className="text-xs text-[var(--text-secondary)] mt-1">{new Date(conv.updated_at).toLocaleDateString()}</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--text-secondary)] hover:text-red-400 transition-all hover:bg-red-500/10 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {conversations.length === 0 && (
                                <div className="text-center text-[var(--text-secondary)] text-sm py-8">
                                    No conversations yet.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Messages List */}
                        {messages.length > 0 ? (
                            <div className="space-y-6">
                                {messages.map((msg, idx) => (
                                    <div key={msg.id || idx} className="group">
                                        <div className="flex items-center space-x-2 mb-1.5 opacity-60">
                                            {msg.role === 'assistant' ? (
                                                <div className="w-5 h-5 rounded bg-orange-500/10 flex items-center justify-center">
                                                    <config.Icon className="w-3 h-3 text-orange-500" />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center">
                                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                                </div>
                                            )}
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                                                {msg.role === 'assistant' ? 'AI Assistant' : 'You'}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className={cn(
                                            "prose prose-invert prose-sm max-w-none",
                                            msg.role === 'assistant' ? "" : "text-[var(--text-primary)] bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-default)]"
                                        )}>
                                            {msg.role === 'assistant' ? formatResponse(msg.text) : <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex items-center space-x-2 text-[var(--text-secondary)] animate-pulse">
                                        <div className="w-4 h-4 rounded-full bg-[var(--bg-surface)]" />
                                        <span className="text-xs">Generating response...</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Empty State (Only if no messages) */
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-0 animate-fadeIn" style={{ animationFillMode: 'forwards', animationDelay: '0.2s' }}>
                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-4 ring-1 ring-[var(--border-default)]">
                                    <config.Icon className="w-6 h-6 text-[var(--text-secondary)]" style={{ color: config.color }} />
                                </div>
                                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                    {config.label} Assistant
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] max-w-[200px] leading-relaxed">
                                    {config.placeholder}
                                </p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !isLoading && (
                            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2">
                                <span className="text-red-400 mt-0.5">⚠️</span>
                                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
                            </div>
                        )}
                    </>
                )}
                <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input Area */}
            <div className="border-t border-[var(--border-default)] flex-shrink-0 relative">
                {/* Live Fix Popup */}
                {pendingFix && (
                    <div className="absolute bottom-full left-0 w-full p-4 bg-[var(--bg-surface)] border-t border-[var(--border-default)] shadow-xl z-50 animate-slideUp">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2 text-green-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Proposed Changes</span>
                            </div>
                            <button onClick={() => setPendingFix(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => {
                                    useFileStore.getState().updateFileContent(activeFileId!, pendingFix.new);
                                    setPendingFix(null);
                                    addMessage({
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        text: '**Changes applied successfully.**',
                                        timestamp: Date.now()
                                    });
                                }}
                                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded text-xs font-medium transition-colors"
                            >
                                Accept & Apply
                            </button>
                            <button
                                onClick={() => setPendingFix(null)}
                                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-[var(--text-primary)] py-1.5 rounded text-xs font-medium transition-colors"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}

                {/* Mention Dropdown */}
                {showMentions && filteredFiles.length > 0 && (
                    <div
                        className="absolute bottom-full left-3 mb-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto"
                    >
                        <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
                            Mention File
                        </div>
                        {filteredFiles.map((file, idx) => (
                            <button
                                key={file.id}
                                onClick={() => insertMention(file.name)}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-xs flex items-center space-x-2 hover:bg-[var(--bg-surface-hover)] transition-colors",
                                    idx === mentionIndex ? "bg-neutral-800 text-[var(--text-primary)]" : "text-neutral-300"
                                )}
                            >
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>{file.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Text Input */}
                <div className="p-3">
                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything (Ctrl+L), @ to mention, / for workflows"
                            rows={2}
                            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2 pr-20 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-default)] resize-none"
                        />
                        <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                            {isSpeaking && (
                                <button
                                    onClick={stopSpeaking}
                                    className="p-1.5 text-orange-500 animate-pulse hover:text-orange-600 transition-colors"
                                    title="Stop Speaking"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={toggleListening}
                                className={cn(
                                    "p-1.5 transition-colors rounded-full",
                                    isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                                title={isListening ? "Listening..." : "Voice Input"}
                            >
                                <Mic className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleAnalyze}
                                disabled={isLoading}
                                className={cn(
                                    "p-1.5 rounded transition-colors",
                                    !isLoading
                                        ? "bg-orange-500 text-[var(--text-primary)] hover:bg-orange-600"
                                        : "bg-neutral-700 text-[var(--text-secondary)]"
                                )}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="px-3 pb-2">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className={cn(
                            "w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2",
                            isLoading ? "bg-neutral-800 text-[var(--text-secondary)]" : "text-[var(--text-primary)] hover:opacity-90"
                        )}
                        style={{ backgroundColor: isLoading ? undefined : config.color }}
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <span>{config.buttonText}</span>
                        )}
                    </button>
                </div>

                {/* Footer Controls */}
                <div className="px-3 pb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {/* Add Button */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-neutral-300 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {showAddMenu && (
                                <div className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                                    <button className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2">
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Add File</span>
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2">
                                        <Image className="w-3.5 h-3.5" />
                                        <span>Add Image</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setInput(input + '@');
                                            setShowAddMenu(false);
                                            inputRef.current?.focus();
                                            // The onChange won't trigger automatically here, so we manually trigger logic or rely on them typing next
                                            // Ideally we manually trigger the mention state:
                                            setMentionQuery('');
                                            setShowMentions(true);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-[var(--bg-surface-hover)] flex items-center space-x-2"
                                    >
                                        <AtSign className="w-3.5 h-3.5" />
                                        <span>Mention File</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mode Toggle */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowModeDropdown(!showModeDropdown); }}
                                className="flex items-center space-x-1.5 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-neutral-200 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
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
                                                selectedMode === mode.id && "bg-neutral-800"
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
                                onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); }}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-neutral-200 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                            >
                                <ChevronUp className="w-3 h-3" />
                                <span className={cn(
                                    "truncate max-w-[80px]", // Truncate long model names
                                    selectedModel === 'moonshot-k2' && "text-[10px]" // Smaller text for Kimi
                                )}>{currentModel.name}</span>
                            </button>
                            {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[200px] z-50 animate-fadeIn">
                                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Model</div>
                                    {AI_MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => { setModel(model.id); setShowModelDropdown(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] flex items-center justify-between group",
                                                selectedModel === model.id && "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                                            )}
                                        >
                                            <span>{model.name}</span>
                                            {model.suffix && <span className="text-[9px] text-[var(--text-secondary)] opacity-50 group-hover:opacity-100">{model.suffix}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Skill Level Selector */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowSkillDropdown(!showSkillDropdown); }}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-neutral-200 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                                title="Adjust AI Skill Level"
                            >
                                <ChevronUp className="w-3 h-3" />
                                <GraduationCap className={cn("w-3 h-3", skillLevel === 'beginner' ? 'text-green-400' : skillLevel === 'expert' ? 'text-red-400' : 'text-blue-400')} />
                                <span className={cn("capitalize", skillLevel === 'beginner' ? 'text-green-400' : skillLevel === 'expert' ? 'text-red-400' : 'text-blue-400')}>
                                    {skillLevel}
                                </span>
                            </button>
                            {showSkillDropdown && (
                                <div className="absolute bottom-full right-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 min-w-[150px] z-50 animate-fadeIn">
                                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Skill Level</div>
                                    {['beginner', 'intermediate', 'expert'].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => { setSkillLevel(level as any); setShowSkillDropdown(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-hover)] flex items-center justify-between capitalize",
                                                skillLevel === level ? "text-[var(--text-primary)] bg-[var(--bg-surface-hover)]" : "text-[var(--text-secondary)]"
                                            )}
                                        >
                                            <span>{level}</span>
                                            {skillLevel === level && <CheckCircle2 className="w-3 h-3 text-orange-500" />}
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
