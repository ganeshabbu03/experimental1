import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, MoreHorizontal, Maximize, Minimize2, X, TerminalSquare, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTerminalStore } from '@/stores/useTerminalStore';
import { useFileStore } from '@/stores/useFileStore';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useParams } from 'react-router-dom';
import 'xterm/css/xterm.css';

export default function Terminal() {
    const [activeTab, setActiveTab] = useState<'Problems' | 'Output' | 'Debug Console' | 'Terminal' | 'Ports'>('Terminal');
    const { setTerminalOpen, toggleTerminalMaximized, isTerminalMaximized } = useLayoutStore();
    const { projectId } = useParams();
    const { projectName } = useFileStore();
    const {
        sessions,
        activeSessionId,
        addSession,
        deleteActiveSession,
        setActiveSession,
        connect,
        disconnect,
        socket,
        sendInput,
        resizeTerminal
    } = useTerminalStore();

    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // Initialize Store Connection
    useEffect(() => {
        connect({ workspaceId: projectId, projectName });
        return () => disconnect();
    }, [connect, disconnect, projectId, projectName]);

    // Initialize XTerm
    useEffect(() => {
        if (!terminalRef.current || activeTab !== 'Terminal') return;

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#181818',
                foreground: '#cccccc',
                cursor: '#cccccc',
                selectionBackground: '#ffffff33',
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        term.onData(data => {
            sendInput(data);
        });

        term.onResize(size => {
            resizeTerminal(size.cols, size.rows);
        });

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Write any buffered data if needed (optional)

        return () => {
            term.dispose();
            xtermRef.current = null;
        };
    }, [activeTab]); // Re-initialize when switching back to Terminal tab

    // Handle incoming data
    useEffect(() => {
        if (!socket || !xtermRef.current) return;

        const handleData = (data: string) => {
            xtermRef.current?.write(data);
        };

        socket.on('terminal.data', handleData);
        return () => {
            socket.off('terminal.data', handleData);
        };
    }, [socket, activeTab]);

    // Handle resize on panel change
    useEffect(() => {
        const timer = setTimeout(() => {
            fitAddonRef.current?.fit();
        }, 100);
        return () => clearTimeout(timer);
    }, [isTerminalMaximized, activeTab]);

    const handleAddSession = () => {
        addSession('terminal');
    };

    const handleDeleteSession = () => {
        deleteActiveSession();
    };

    return (
        <div className="h-full bg-[#181818] flex flex-col font-mono text-[13px] overflow-hidden text-[#cccccc]">
            {/* Tabs Header */}
            <div className="h-9 px-4 flex items-center flex-shrink-0 select-none gap-4 border-b border-[#2b2b2b]">
                {['Problems', 'Output', 'Debug Console', 'Terminal', 'Ports'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "h-full relative flex items-center transition-colors pb-[2px]",
                            activeTab === tab
                                ? "text-[#e7e7e7]"
                                : "text-[#8c8c8c] hover:text-[#e7e7e7]"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-[#007acc]" />
                        )}
                    </button>
                ))}

                <div className="flex-1" />

                {/* Right controls */}
                <div className="flex items-center gap-[2px] text-[#cccccc]">
                    <div
                        className="flex items-center hover:bg-[#ffffff1a] rounded cursor-pointer px-1 py-0.5"
                        onClick={handleAddSession}
                        title="Add Terminal"
                    >
                        <Plus className="h-[14px] w-[14px]" />
                        <ChevronDown className="h-3 w-3 ml-[2px]" />
                    </div>
                    {sessions.length > 0 && (
                        <div
                            className="hover:bg-[#ffffff1a] rounded cursor-pointer p-[3px] ml-1"
                            onClick={handleDeleteSession}
                            title="Kill Terminal"
                        >
                            <Trash2 className="h-4 w-4" />
                        </div>
                    )}
                    <div className="hover:bg-[#ffffff1a] rounded cursor-pointer p-[3px] ml-1">
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                    <div className="w-[1px] h-3 bg-[#4d4d4d] mx-2" />
                    <div
                        className="hover:bg-[#ffffff1a] rounded cursor-pointer p-[3px]"
                        onClick={toggleTerminalMaximized}
                        title={isTerminalMaximized ? "Restore Panel Size" : "Maximize Panel Size"}
                    >
                        {isTerminalMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                    </div>
                    <div
                        className="hover:bg-[#ffffff1a] rounded cursor-pointer p-[3px]"
                        onClick={() => setTerminalOpen(false)}
                        title="Close Panel"
                    >
                        <X className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'Terminal' ? (
                    <>
                        {/* Main Terminal View */}
                        <div className="flex-1 h-full relative overflow-hidden">
                            <div
                                ref={terminalRef}
                                className="absolute inset-0 p-3 xterm-container"
                            />
                        </div>

                        {/* Right Sidebar (Terminal Sessions) */}
                        <div className="w-[160px] shrink-0 border-l border-[#2b2b2b] flex flex-col py-1 select-none">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className={cn(
                                        "px-3 py-[2px] flex items-center gap-2 cursor-pointer group",
                                        activeSessionId === session.id ? "bg-[#37373d]" : "hover:bg-[#2a2d2e]"
                                    )}
                                    onClick={() => setActiveSession(session.id)}
                                >
                                    <TerminalSquare className="h-[14px] w-[14px] text-[#cccccc]" />
                                    <span className={cn(
                                        "flex-1 truncate text-[12px] pt-[1px]",
                                        activeSessionId === session.id ? "text-white" : "text-[#cccccc]"
                                    )}>
                                        {session.name}
                                    </span>
                                    {session.hasWarning && (
                                        <AlertTriangle className="h-[13px] w-[13px] text-[#cca700]" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : activeTab === 'Problems' ? (
                    <div className="flex-1 flex flex-col p-4 overflow-auto">
                        <div className="flex items-center gap-2 text-[#8c8c8c] mb-4">
                            <span className="font-bold">0</span> Problems
                        </div>
                        <div className="text-[12px] text-[#8c8c8c] italic">
                            No problems have been detected in the workspace so far.
                        </div>
                    </div>
                ) : activeTab === 'Output' ? (
                    <div className="flex-1 flex flex-col p-4 overflow-auto font-mono text-[12px]">
                        <div className="flex items-center gap-2 text-[#8c8c8c] mb-2 border-b border-[#2b2b2b] pb-2">
                            <span>Show output from:</span>
                            <select className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-1 text-[#cccccc] outline-none">
                                <option>Tasks</option>
                                <option>Extension Host</option>
                                <option>GitHub Authentication</option>
                            </select>
                        </div>
                        <div className="text-[#8c8c8c]">
                            [info] Initializing extension host...
                            <br />
                            [info] Finished loading extensions.
                        </div>
                    </div>
                ) : activeTab === 'Debug Console' ? (
                    <div className="flex-1 flex flex-col p-4 overflow-auto font-mono text-[12px]">
                        <div className="text-[#8c8c8c] italic">
                            The debug console is empty. Start a debug session to see output here.
                        </div>
                        <div className="mt-auto flex items-center border-t border-[#2b2b2b] pt-2">
                            <span className="text-blue-500 mr-2">&gt;</span>
                            <input
                                className="bg-transparent border-none outline-none text-[#cccccc] flex-1"
                                placeholder="Type a debug command or expression"
                                readOnly
                            />
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-[#8c8c8c] flex-1">
                        {activeTab} content goes here...
                    </div>
                )}
            </div>
        </div>
    );
}
