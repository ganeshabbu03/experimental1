import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, User, Zap, FileText, Box } from 'lucide-react';
import { useAIStore } from '@/stores/useAIStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useFileStore, type FileNode } from '@/stores/useFileStore';
import { cn } from '@/utils/cn';

export default function AiAssistant() {
    const { isChatOpen, toggleChat, messages, addMessage, updateLastMessage, isLoading, setLoading, triggerMessage, setTriggerMessage } = useAIStore();
    const { projects } = useProjectStore();
    const { files } = useFileStore();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        if (isChatOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [messages, isChatOpen]);

    // Effect to handle triggers (e.g., from Dashboard)
    useEffect(() => {
        if (triggerMessage && isChatOpen) {
            processMessage(triggerMessage);
            setTriggerMessage(null); // Clear after processing
        }
    }, [triggerMessage, isChatOpen]);

    // Helper to find file content
    const findFileContent = (nodes: FileNode[], fileName: string): string | null => {
        for (const node of nodes) {
            if (node.type === 'file' && node.name.toLowerCase() === fileName.toLowerCase()) {
                return node.content || null;
            }
            if (node.children) {
                const found = findFileContent(node.children, fileName);
                if (found) return found;
            }
        }
        return null;
    };

    const processMessage = (text: string) => {
        if (!text.trim() || isLoading) return;

        const userText = text.trim();
        addMessage({
            id: Date.now().toString(),
            role: 'user',
            text: userText,
            timestamp: Date.now()
        });
        setInput('');
        setLoading(true);

        const readmeContent = findFileContent(files, 'readme.md');
        const packageJsonContent = findFileContent(files, 'package.json');

        // Simulation of AI processing
        setTimeout(() => {
            const lowercaseInput = userText.toLowerCase();
            const foundProject = projects.find(p => lowercaseInput.includes(p.name.toLowerCase()));

            let responseText = '';

            // Smart Context Injection
            if (lowercaseInput.includes('readme') && readmeContent) {
                responseText = `### 📄 README.md\n\n${readmeContent}\n\n`;
            } else if (lowercaseInput.includes('package') && packageJsonContent) {
                responseText = `### 📦 package.json\n\n\`\`\`json\n${packageJsonContent}\n\`\`\`\n\n`;
            } else if (foundProject) {
                // Construct Rich Response WITHOUT File Structure
                responseText = `### 🚀 ${foundProject.name}\n\n`;

                if (foundProject.fullDescription) {
                    responseText += `${foundProject.fullDescription}\n\n`;
                } else {
                    responseText += `${foundProject.description}\n\n`;
                }

                // Tech Stack & Tools (How it is made)
                if (foundProject.techStack) {
                    responseText += `**🛠️ Tech Stack & Tools:**\n${foundProject.techStack.join(' • ')}\n\n`;
                }

                // Application Architecture
                if (foundProject.architecture) {
                    responseText += `**🏗️ Architecture:**\n${foundProject.architecture}\n\n`;
                }

                // Key Features
                if (foundProject.features) {
                    responseText += `**✨ Key Features:**\n${foundProject.features.map(f => `- ${f}`).join('\n')}\n\n`;
                }

                responseText += `\n_Last updated: ${foundProject.lastModified}_`;

            } else if (lowercaseInput.includes('hello') || lowercaseInput.includes('hi')) {
                responseText = "Hello! I am Deexen AI. I can analyze your project structure, read `README.md` and `package.json`, and answer questions about your codebase.";
            } else {
                // Contextual Fallback
                if (readmeContent || packageJsonContent) {
                    responseText = "I've analyzed your project files. You can ask me about the **README**, **dependencies**, or specific project details.";
                    if (readmeContent) responseText += "\n- Ask 'What is in the README?'";
                    if (packageJsonContent) responseText += "\n- Ask 'Show package.json'";
                } else {
                    responseText = `I can tell you about your projects:\n\n${projects.map(p => `- **${p.name}** (${p.language})`).join('\n')}\n\nTry clicking the AI icon on a project or asking "Explain [project name]".`;
                }
            }

            // Start Streaming
            const messageId = (Date.now() + 1).toString();
            // Add empty message first
            addMessage({
                id: messageId,
                role: 'assistant',
                text: '', // Start empty
                timestamp: Date.now()
            });

            let currentIndex = 0;
            const streamInterval = setInterval(() => {
                if (currentIndex < responseText.length) {
                    // Update content
                    const nextChunk = responseText.substring(0, currentIndex + 1);
                    updateLastMessage(nextChunk);
                    currentIndex++;
                    // Scroll to bottom during streaming
                    if (messagesEndRef.current) {
                        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
                    }
                } else {
                    clearInterval(streamInterval);
                    setLoading(false);
                }
            }, 5); // Typing speed

        }, 1000); // Initial delay
    };

    const handleSend = () => {
        processMessage(input);
    };

    const handleQuickAction = (actionText: string) => {
        processMessage(actionText);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    // Helper to format messages (basic markdown support)
    const renderMessageText = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('### ')) {
                return <h4 key={i} className="text-lg font-bold text-[var(--text-primary)] mt-2 mb-1 flex items-center gap-2">{line.replace('### ', '')}</h4>;
            }
            if (line.startsWith('**') && line.includes(':**')) {
                const parts = line.split(':**');
                return <p key={i} className="mt-2 mb-1"><span className="font-semibold text-orange-600 dark:text-orange-400">{parts[0].replace('**', '')}:</span>{parts[1]}</p>;
            }
            if (line.startsWith('```')) {
                // Very basic code block handling
                return null;
            }
            if (line.startsWith('- **')) {
                return <li key={i} className="ml-4 list-disc text-[var(--text-secondary)]">{line.replace('- ', '').replace(/\*\*/g, '')}</li>
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 list-disc text-[var(--text-secondary)]">{line.replace('- ', '')}</li>
            }
            if (line.trim().startsWith('src') || line.trim().startsWith('/')) {
                return <pre key={i} className="text-xs font-mono text-[var(--text-tertiary)] pl-4 my-1 opacity-70">{line}</pre>;
            }
            if (line.startsWith('_') && line.endsWith('_')) {
                return <p key={i} className="text-xs text-[var(--text-tertiary)] mt-2 italic">{line.replace(/_/g, '')}</p>
            }
            if (line === '') return <br key={i} />;

            return <p key={i} className="text-[var(--text-primary)] leading-relaxed font-sans">{line.replace(/\*\*/g, '')}</p>;
        });
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
            {/* Chat Window */}
            <div
                className={cn(
                    "mb-4 w-80 sm:w-96 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col",
                    isChatOpen
                        ? "opacity-100 scale-100 translate-y-0 h-[600px]"
                        : "opacity-0 scale-95 translate-y-4 pointer-events-none h-0"
                )}
            >
                {/* Header */}
                <div className="h-16 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center space-x-3">
                        <img src="/deexenlogo.png" alt="Deexen AI" className="w-10 h-10 rounded-xl object-cover bg-white" />
                        <div>
                            <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">Deexen AI</h3>
                            <div className="flex items-center space-x-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)] font-medium">Online & Ready</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={toggleChat}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[var(--bg-surface)]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex space-x-3", msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row")}>
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border overflow-hidden",
                                    msg.role === 'user'
                                        ? "bg-[var(--bg-surface-hover)] border-[var(--border-default)]"
                                        : "border-transparent"
                                )}
                            >
                                {msg.role === 'user' ? <User className="w-4 h-4 text-[var(--text-secondary)]" /> : <img src="/deexenlogo.png" alt="AI" className="w-full h-full object-cover" />}
                            </div>
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-tr-sm"
                                        : "bg-[var(--bg-canvas)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-tl-sm"
                                )}
                            >
                                {msg.role === 'assistant' ? renderMessageText(msg.text) : (
                                    msg.text.split('\n').map((line, i) => (
                                        <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex space-x-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-orange-500/20 bg-orange-500/10">
                                <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
                            </div>
                            <div className="bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-2xl p-4 flex items-center space-x-1 rounded-tl-sm">
                                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                <div className="px-4 pb-3 bg-[var(--bg-surface)] flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap mask-linear-fade pt-2">
                    <button
                        onClick={() => handleQuickAction("Explain README")}
                        className="flex items-center space-x-1.5 bg-[var(--bg-canvas)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] hover:border-orange-500/30 text-[var(--text-secondary)] hover:text-orange-600 dark:hover:text-orange-400 text-xs px-3 py-1.5 rounded-full transition-all"
                    >
                        <FileText className="w-3 h-3" />
                        <span>README</span>
                    </button>
                    <button
                        onClick={() => handleQuickAction("Show package.json")}
                        className="flex items-center space-x-1.5 bg-[var(--bg-canvas)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] hover:border-orange-500/30 text-[var(--text-secondary)] hover:text-orange-600 dark:hover:text-orange-400 text-xs px-3 py-1.5 rounded-full transition-all"
                    >
                        <Box className="w-3 h-3" />
                        <span>package.json</span>
                    </button>
                    {projects.slice(0, 2).map(p => (
                        <button
                            key={p.id}
                            onClick={() => handleQuickAction(`Explain ${p.name}`)}
                            className="flex items-center space-x-1.5 bg-[var(--bg-canvas)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] hover:border-orange-500/30 text-[var(--text-secondary)] hover:text-orange-600 dark:hover:text-orange-400 text-xs px-3 py-1.5 rounded-full transition-all"
                        >
                            <Zap className="w-3 h-3 text-orange-500" />
                            <span>{p.name}</span>
                        </button>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-default)] shrink-0">
                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Deexen AI..."
                            className="w-full h-11 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl pl-4 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 p-2 bg-gradient-to-tr from-orange-500 to-red-600 rounded-lg text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-50 disabled:shadow-none hover:scale-105 transition-all"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
