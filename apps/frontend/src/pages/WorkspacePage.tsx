import React, { useState, useEffect } from 'react';
import { FileCode, Search, GitBranch, Settings, ArrowLeft, Puzzle, Blocks, Activity, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils/cn';

import { useFileStore, getFileBreadcrumbs, type FileNode } from '@/stores/useFileStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useProjectStore } from '@/stores/useProjectStore';
import FileExplorer from '@/components/file-explorer/FileExplorer';
import CodeEditor from '@/components/editor/CodeEditor';
import { runWorkspaceTour } from '@/services/tourService';
import Terminal from '@/components/terminal/Terminal';
import AIPanel from '@/components/ai-panel/AIPanel';
import SourceControl from '@/components/source-control/SourceControl';
import { SidebarExtensionList } from '@/components/marketplace/SidebarExtensionList';
import { ExtensionDetailView } from '@/components/marketplace/ExtensionDetailView';
import { usePluginStore } from '@/stores/usePluginStore';

// Activity Bar Component
// ActivityBar Component
interface ActivityBarProps {
    activeView: string;
    onIconClick: (viewId: string) => void;
}

const ActivityBar = ({ activeView, onIconClick }: ActivityBarProps) => {
    const icons = [
        { id: 'explorer', icon: FileCode, label: 'Explorer' },
        { id: 'search', icon: Search, label: 'Search' },
        { id: 'git', icon: GitBranch, label: 'Source Control' },
        { id: 'extensions', icon: Puzzle, label: 'Extensions' },
    ];

    return (
        <div className="w-12 bg-[var(--bg-canvas)] border-r border-[var(--border-default)] flex flex-col items-center py-2 flex-shrink-0">
            {icons.map(item => (
                <button
                    key={item.id}
                    id={`activity-bar-${item.id}`}
                    onClick={() => onIconClick(item.id)}
                    title={item.label}
                    className={cn(
                        "w-10 h-10 flex items-center justify-center relative transition-colors",
                        activeView === item.id
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                >
                    {activeView === item.id && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-orange-500" />
                    )}
                    <item.icon className="w-5 h-5" />
                </button>
            ))}

            <div className="flex-1" />

            <button
                title="Settings"
                onClick={() => onIconClick('settings')}
                className={cn(
                    "w-10 h-10 flex items-center justify-center relative transition-colors",
                    activeView === 'settings'
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
            >
                {activeView === 'settings' && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-orange-500" />
                )}
                <Settings className="w-5 h-5" />
            </button>
        </div>
    );
};

export default function WorkspacePage() {
    const navigate = useNavigate();
    const [activeSidebarView, setActiveSidebarView] = useState('explorer');
    const [leftPanelWidth, setLeftPanelWidth] = useState(240);
    const [rightPanelWidth, setRightPanelWidth] = useState(320);
    const [terminalHeight, setTerminalHeight] = useState(200);
    const [isDragging, setIsDragging] = useState<'left' | 'right' | 'terminal' | null>(null);

    const { isSidebarOpen, setSidebarOpen, toggleSidebar, isTerminalOpen, toggleTerminal, isTerminalMaximized, toggleAIPanel, isAIPanelOpen } = useLayoutStore();

    const { projectId } = useParams();
    const { projects } = useProjectStore();

    const { activeFileId, projectName, setFiles, setProjectName } = useFileStore();
    const files = useFileStore(state => state.files); // Selector for persistence/updates

    // Extension Store
    const activeExtensionDetail = usePluginStore(state => state.activeExtensionDetail);

    const handleIconClick = (viewId: string) => {
        if (activeSidebarView === viewId) {
            // Toggle sidebar if clicking the same icon
            toggleSidebar();
        } else {
            // Switch view and ensure sidebar is open
            setActiveSidebarView(viewId);
            if (!isSidebarOpen) {
                setSidebarOpen(true);
            }
        }
    };

    const activeFilePath = activeFileId ? getFileBreadcrumbs(files, activeFileId) : '';

    // Load Project Data
    useEffect(() => {
        if (!projectId) return;

        const project = projects.find(p => p.id === projectId);
        if (project) {
            setProjectName(project.name);

            if (project.fileTree) {
                setFiles(project.fileTree);
            } else {
                // Default structure for new/empty projects
                const defaultFiles: FileNode[] = [
                    {
                        id: 'root',
                        name: 'root',
                        type: 'folder',
                        isOpen: true,
                        children: [
                            {
                                id: 'project',
                                name: 'project',
                                type: 'folder',
                                isOpen: true,
                                children: [
                                    {
                                        id: 'document.txt',
                                        name: 'document.txt',
                                        type: 'file',
                                        content: project.description || `Welcome to your new blank project: ${project.name}`
                                    }
                                ]
                            }
                        ]
                    }
                ];
                setFiles(defaultFiles);
            }
        } else {
            // Project not found - likely deleted or invalid ID
            navigate('/dashboard');
        }
    }, [projectId, projects, setFiles, setProjectName, navigate]);



    // ... existing resize logic ...

    const startResize = (direction: 'left' | 'right' | 'terminal') => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(direction);
    };

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => {
            if (isDragging === 'left') {
                const newWidth = e.clientX - 48;
                if (newWidth > 150 && newWidth < 400) setLeftPanelWidth(newWidth);
            } else if (isDragging === 'right') {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 300 && newWidth < 500) setRightPanelWidth(newWidth);
            } else if (isDragging === 'terminal') {
                const newHeight = window.innerHeight - e.clientY - 22;
                if (newHeight > 100 && newHeight < window.innerHeight - 200) setTerminalHeight(newHeight);
            }
        };

        const onMouseUp = () => setIsDragging(null);

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);

    // Tour Trigger
    const { hasSeenWorkspaceTour, completeWorkspaceTour } = useLayoutStore();
    useEffect(() => {
        if (!hasSeenWorkspaceTour) {
            setTimeout(() => {
                runWorkspaceTour(completeWorkspaceTour);
            }, 1000);
        }
    }, [hasSeenWorkspaceTour, completeWorkspaceTour]);

    return (
        <div className={cn(
            "h-screen w-screen flex flex-col bg-[var(--bg-canvas)] overflow-hidden text-[var(--text-primary)] font-sans",
            isDragging && "cursor-grabbing select-none"
        )}>
            {/* Title Bar */}
            <div className="h-8 bg-[var(--bg-canvas)] border-b border-[var(--border-default)] flex items-center px-3 text-xs select-none z-10">
                <div
                    id="back-to-dashboard-btn"
                    className="flex items-center space-x-2 cursor-pointer hover:text-[var(--text-primary)] transition-colors text-[var(--text-secondary)]"
                    onClick={() => navigate('/dashboard')}
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Dashboard</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-[var(--text-primary)]">{projectName}</span>
                    {activeFilePath && (
                        <>
                            <span className="text-[var(--text-secondary)] mx-2">—</span>
                            <span className="text-[var(--text-secondary)]">{activeFilePath}</span>
                        </>
                    )}
                </div>

                {/* Layout Controls - Right Aligned */}
                <div className="flex items-center space-x-1">
                    <button
                        onClick={toggleSidebar}
                        title="Toggle Sidebar"
                        className={cn(
                            "p-1 rounded-[2px] hover:bg-[var(--bg-surface-hover)] transition-colors",
                            isSidebarOpen ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className="w-3.5 h-3.5 border border-current rounded-[2px] relative">
                            {isSidebarOpen ? (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-current" />
                            ) : (
                                <div className="absolute left-[3px] top-0 bottom-0 w-[1px] bg-current" />
                            )}
                        </div>
                    </button>
                    <button
                        id="terminal-toggle-btn"
                        onClick={toggleTerminal}
                        title="Toggle Terminal"
                        className={cn(
                            "p-1 rounded-[2px] hover:bg-[var(--bg-surface-hover)] transition-colors",
                            isTerminalOpen ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className="w-3.5 h-3.5 border border-current rounded-[2px] relative">
                            {isTerminalOpen ? (
                                <div className="absolute left-0 right-0 bottom-0 h-1 bg-current" />
                            ) : (
                                <div className="absolute left-0 right-0 bottom-[3px] h-[1px] bg-current" />
                            )}
                        </div>
                    </button>
                    <button
                        onClick={toggleAIPanel}
                        title="Toggle AI Panel"
                        className={cn(
                            "p-1 rounded-[2px] hover:bg-[var(--bg-surface-hover)] transition-colors",
                            isAIPanelOpen ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className="w-3.5 h-3.5 border border-current rounded-[2px] relative">
                            {isAIPanelOpen ? (
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-current" />
                            ) : (
                                <div className="absolute right-[3px] top-0 bottom-0 w-[1px] bg-current" />
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Activity Bar */}
                <div id="activity-bar">
                    <ActivityBar activeView={activeSidebarView} onIconClick={handleIconClick} />
                </div>

                {/* Left Sidebar */}
                {isSidebarOpen && (
                    <div
                        style={{ width: leftPanelWidth }}
                        className="flex-shrink-0 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-default)] relative z-10"
                    >
                        {/* Sidebar Header */}
                        <div className="h-9 flex items-center px-4 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-default)]">
                            {activeSidebarView === 'explorer' && 'Explorer'}
                            {activeSidebarView === 'search' && 'Search'}
                            {activeSidebarView === 'git' && 'Source Control'}
                            {activeSidebarView === 'extensions' && 'Extensions'}
                            {activeSidebarView === 'settings' && 'Project Settings'}
                        </div>

                        {/* Sidebar Content */}
                        <div className="flex-1 overflow-auto">
                            {activeSidebarView === 'explorer' && (
                                <div id="file-explorer-pane">
                                    <FileExplorer />
                                </div>
                            )}
                            {activeSidebarView === 'search' && (
                                <div className="p-3">
                                    <input
                                        className="w-full h-8 px-3 bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-orange-500"
                                        placeholder="Search..."
                                    />
                                </div>
                            )}
                            {activeSidebarView === 'git' && (
                                <div className="h-full flex flex-col">
                                    <SourceControl />
                                </div>
                            )}
                            {activeSidebarView === 'extensions' && (
                                <div className="h-full flex flex-col">
                                    <SidebarExtensionList />
                                </div>
                            )}
                            {activeSidebarView === 'settings' && (
                                <div className="p-4 space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <ProjectSettingsPanel project={projects.find(p => p.id === projectId)} />
                                </div>
                            )}
                        </div>

                        {/* Resize Handle */}
                        <div
                            className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize hover:bg-orange-500/50 transition-colors"
                            onMouseDown={startResize('left')}
                        />
                    </div>
                )}

                {/* Main Editor Area */}
                <div id="editor-pane" className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] relative">
                    {/* Editor Header / Tabs removed to prevent duplicate bars */}

                    {/* Editor or Extension Details */}
                    <div className="flex-1 min-h-0 flex flex-col relative bg-[var(--bg-canvas)]">
                        {activeExtensionDetail ? (
                            <ExtensionDetailView />
                        ) : (
                            <CodeEditor />
                        )}
                    </div>

                    {/* Terminal Resize Handle */}
                    {isTerminalOpen && !isTerminalMaximized && (
                        <div
                            className="h-1 bg-[var(--bg-surface)] cursor-row-resize hover:bg-orange-500/50 transition-colors z-20 relative"
                            onMouseDown={startResize('terminal')}
                        />
                    )}

                    {/* Terminal */}
                    {isTerminalOpen && (
                        <div
                            style={isTerminalMaximized ? {} : { height: terminalHeight }}
                            className={cn(
                                "flex-shrink-0 bg-[var(--bg-canvas)] border-t border-[var(--border-default)] z-30",
                                isTerminalMaximized && "absolute inset-0"
                            )}>
                            <Terminal />
                        </div>
                    )}
                </div>

                {/* Right Panel (AI) */}
                {isAIPanelOpen && (
                    <>
                        <div
                            className="w-1 bg-[var(--bg-surface)] cursor-col-resize hover:bg-orange-500/50 transition-colors flex-shrink-0"
                            onMouseDown={startResize('right')}
                        />
                        <div style={{ width: rightPanelWidth }} className="flex-shrink-0 bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
                            <AIPanel />
                        </div>
                    </>
                )}
            </div>

            {/* Status Bar */}
            <div className="h-[22px] bg-[#007acc] border-t border-[var(--border-default)] flex items-center px-3 text-[11px] text-white justify-between select-none flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                        <GitBranch className="w-3 h-3 mr-1" />
                        main
                    </span>
                    <span>0 errors</span>
                </div>
                <div className="flex items-center space-x-3">
                    <span>Ln 42, Col 18</span>
                    <span>UTF-8</span>
                    <span>TypeScript React</span>
                    <span className="text-orange-500">● AI Active</span>
                </div>
            </div>
        </div>
    );
}
// Project Settings Panel Component
function ProjectSettingsPanel({ project }: { project: any }) {
    if (!project) return null;

    const sections = [
        { label: 'Name', value: project.name, icon: FileCode },
        { label: 'Status', value: project.status || 'Development', icon: Activity },
        { label: 'Main Branch', value: project.branch || 'main', icon: GitBranch },
        { label: 'Language', value: project.language, icon: Blocks },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center text-center pb-2 border-b border-[var(--border-muted)]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20 text-white">
                    <span className="text-2xl font-bold">{project.name.charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="font-display font-bold text-[var(--text-primary)] text-lg leading-tight">{project.name}</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-1 tracking-wide uppercase font-medium">Project ID: {project.id.slice(0, 8)}</p>
            </div>

            <div className="space-y-4">
                {sections.map((section, i) => (
                    <div key={i} className="group">
                        <div className="flex items-center gap-2 mb-1.5">
                            <section.icon className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">{section.label}</span>
                        </div>
                        <div className="px-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] font-medium group-hover:border-orange-500/30 transition-colors">
                            {section.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">Description</span>
                </div>
                <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-secondary)] leading-relaxed italic">
                    {project.description || 'No description provided for this workspace.'}
                </div>
            </div>

            <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                    <Puzzle className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">Tech Stack</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {project.techStack?.length ? (
                        project.techStack.map((tech: string) => (
                            <span key={tech} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                                {tech}
                            </span>
                        ))
                    ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)] italic">Auto-detecting...</span>
                    )}
                </div>
            </div>
        </div>
    );
}
