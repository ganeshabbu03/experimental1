import { useState, useRef, useEffect } from 'react';
import { Plus, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Client } from 'rpc-websockets';
import { aiService } from '@/services/aiService';

interface TerminalLine {
    id: number;
    content: React.ReactNode;
}

export default function Terminal() {
    const [activeTab, setActiveTab] = useState<'terminal' | 'output' | 'problems'>('terminal');
    const [history, setHistory] = useState<TerminalLine[]>([
        { id: 1, content: <span className="text-[var(--text-secondary)]">Welcome to Deexen Terminal</span> },
        { id: 2, content: <span className="text-[var(--text-secondary)]">Connecting to Extension Host...</span> },
    ]);
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const rpcClient = useRef<Client | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // AI Integration
    // const { addMessage, currentConversationId } = useAIStore();

    useEffect(() => {
        const connect = () => {
            // Connect to Extension Host RPC
            const client = new Client('ws://localhost:8081');

            client.on('open', () => {
                setHistory(prev => [...prev, { id: Date.now(), content: <span className="text-green-500">Connected to backend.</span> }]);
                setIsConnected(true);
            });

            client.on('close', () => {
                setIsConnected(false);
            });

            client.on('error', () => {
                // silent
            });

            rpcClient.current = client;
        };

        connect();

        return () => {
            rpcClient.current?.close();
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'terminal') {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, activeTab]);

    const handleCommand = async (cmd: string) => {
        if (!cmd.trim()) return;

        setHistory(prev => [...prev, {
            id: Date.now(),
            content: <div><span className="text-orange-500">$</span> <span className="text-[var(--text-primary)]">{cmd}</span></div>
        }]);

        const lowerCmd = cmd.trim().toLowerCase();

        if (lowerCmd === 'clear') {
            setHistory([]);
            return;
        }

        if (!isConnected || !rpcClient.current) {
            setHistory(prev => [...prev, { id: Date.now(), content: <span className="text-red-400">Error: Not connected to backend.</span> }]);
            return;
        }

        try {
            // Execute on Extension Host
            // We can pass cwd later. For now default.
            const result: any = await rpcClient.current.call('terminal.execute', [cmd]);

            if (result.stdout) {
                setHistory(prev => [...prev, { id: Date.now(), content: <pre className="whitespace-pre-wrap text-[var(--text-secondary)]">{result.stdout}</pre> }]);
            }

            if (result.stderr) {
                setHistory(prev => [...prev, { id: Date.now(), content: <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre> }]);
            }

            // Intelligent Error Handling (Smart Execute)
            if (result.exitCode !== 0) {
                await handleSmartError(cmd, result.stderr || result.stdout);
            }

        } catch (e: any) {
            setHistory(prev => [...prev, { id: Date.now(), content: <span className="text-red-400">RPC Error: {e.message}</span> }]);
        }
    };

    const handleSmartError = async (cmd: string, errorOutput: string) => {
        setHistory(prev => [...prev, {
            id: Date.now(),
            content: (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 my-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 text-red-400 mb-1">
                        <XCircle className="w-4 h-4" />
                        <span className="font-medium">Command Failed</span>
                    </div>
                    <div className="text-[var(--text-secondary)] text-xs mb-2">Analyzing error...</div>
                </div>
            )
        }]);

        try {
            // Ask AI for a fix
            // Use 'livefix' mode for concise JSON/Code response if possible, or 'expert'
            const analysis = await aiService.analyze(
                'debug',
                `The command \`${cmd}\` failed with:\n\`\`\`\n${errorOutput}\n\`\`\`\n\nExplain why briefly and provide the corrected command.`,
                'Terminal Error Analysis'
            );

            setHistory(prev => [...prev, {
                id: Date.now(),
                content: (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3 my-2">
                        <div className="flex items-center space-x-2 text-orange-400 mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-medium">AI Suggestion</span>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--text-primary)]">{analysis}</pre>
                        </div>
                    </div>
                )
            }]);

        } catch (e) {
            console.error("Smart Execute failed", e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommand(input);
            setInput('');
        }
    };

    return (
        <div
            className="h-full bg-[var(--bg-canvas)] flex flex-col font-mono text-xs overflow-hidden"
            onClick={() => activeTab === 'terminal' && inputRef.current?.focus()}
        >
            {/* Tabs */}
            <div className="h-9 px-2 flex items-center border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-shrink-0 select-none gap-1">
                {['terminal', 'output', 'problems'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "px-3 h-7 text-xs capitalize transition-colors rounded",
                            activeTab === tab
                                ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        )}
                    >
                        {tab}
                        {tab === 'problems' && <span className="ml-1.5 text-[var(--text-secondary)]">0</span>}
                    </button>
                ))}
                <div className="flex-1" />
                <button className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 overflow-y-auto cursor-text text-[var(--text-primary)]">
                {activeTab === 'terminal' && (
                    <>
                        {history.map((line) => (
                            <div key={line.id} className="mb-1 leading-relaxed">
                                {line.content}
                            </div>
                        ))}
                        <div className="flex items-center">
                            <span className="text-orange-500 mr-1">$</span>
                            <span className="text-green-500 mr-1">deexen</span>
                            <span className="text-[var(--text-secondary)] mr-2">main</span>
                            <input
                                ref={inputRef}
                                type="text"
                                className="bg-transparent border-none outline-none text-[var(--text-primary)] flex-1 caret-orange-500"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>
                        <div ref={bottomRef} />
                    </>
                )}

                {activeTab === 'output' && (
                    <div className="text-[var(--text-secondary)]">
                        [info] Language server initialized<br />
                        [info] 2 extensions loaded
                    </div>
                )}

                {activeTab === 'problems' && (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
                        No problems detected
                    </div>
                )}
            </div>
        </div>
    );
}
