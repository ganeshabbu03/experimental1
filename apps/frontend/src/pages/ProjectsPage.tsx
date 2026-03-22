import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search,
    GitBranch, Settings, Sun, Moon, Sparkles, Trash2
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAIStore } from '@/stores/useAIStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useToastStore } from '@/stores/useToastStore';
import Sidebar from '@/components/layout/Sidebar';
import AiAssistant from '@/components/AiAssistant/AiAssistant';
import NewProjectModal from '@/components/dashboard/NewProjectModal';

// Mock Commit Hash generator (removed unused)

export default function ProjectsPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isSidebarOpen } = useLayoutStore();
    const { theme, toggleTheme } = useThemeStore();
    const { projects, fetchProjects } = useProjectStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch real projects from API on mount
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleOpenWorkspace = (projectId: string) => {
        navigate(`/workspace/${projectId}`);
    };



    if (!user) return null;

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen w-full bg-[var(--bg-main)] font-sans text-[var(--text-primary)] overflow-hidden">
            {/* 1. Sidebar */}
            <Sidebar />

            {/* 2. Main Canvas */}
            <main className={cn(
                "flex-1 h-full overflow-y-auto overflow-x-hidden relative transition-all duration-300",
                isSidebarOpen ? "ml-64" : "ml-20"
            )}>

                {/* Sticky Header */}
                <header className="sticky top-0 z-40 w-full h-16 glass-panel border-b border-[var(--border-muted)] flex items-center justify-between px-8">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <span onClick={() => navigate('/dashboard')} className="hover:text-[var(--text-primary)] cursor-pointer transition-colors">deexen</span>
                        <span className="text-[var(--text-tertiary)]">/</span>
                        <span className="text-[var(--text-primary)] font-medium cursor-pointer">projects</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] group-focus-within:text-orange-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                ref={searchInputRef}
                                className="w-64 h-9 pl-9 pr-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-sans"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-canvas)] px-1.5 font-mono text-[10px] font-medium text-[var(--text-tertiary)]">
                                    <span className="text-xs">⌘</span>K
                                </kbd>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                            title="Toggle theme"
                        >
                            {theme === 'dark' ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                        <button
                            onClick={() => setIsNewProjectModalOpen(true)}
                            className="h-9 px-4 bg-gradient-primary hover:shadow-lg hover:shadow-orange-500/20 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 transform active:scale-95"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                            <span>New Project</span>
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-6xl mx-auto space-y-8">
                    <div>
                        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">All Projects</h2>
                        <p className="text-[var(--text-secondary)] text-sm mb-6">Manage your workspaces and deployments.</p>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs uppercase text-[var(--text-secondary)] font-medium">
                                        <th className="px-6 py-4">Project Name</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Language</th>
                                        <th className="px-6 py-4">Last Updated</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {filteredProjects.map((project) => (
                                        <ProjectRow
                                            key={project.id}
                                            project={project}
                                            onClick={() => handleOpenWorkspace(project.id)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal */}
            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setIsNewProjectModalOpen(false)}
            />

            <AiAssistant />
        </div>
    );
}

// Project Row Component
interface ProjectRowProps {
    project: any;
    onClick: () => void;
}

function ProjectRow({ project, onClick }: ProjectRowProps) {
    const { setTriggerMessage, setChatOpen } = useAIStore();
    const { deleteProjectAPI } = useProjectStore();
    const { addToast } = useToastStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleAiClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTriggerMessage(`Explain ${project.name}`);
        setChatOpen(true);
        setIsMenuOpen(false);
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
            try {
                await deleteProjectAPI(project.id);
                addToast(`Project "${project.name}" deleted.`, 'info');
            } catch {
                addToast('Failed to delete project.', 'error');
            }
        }
        setIsMenuOpen(false);
    };

    const getLanguageColor = (lang: string) => {
        const colors: Record<string, string> = {
            TypeScript: 'text-blue-500',
            Python: 'text-yellow-500',
            React: 'text-cyan-500',
            Go: 'text-teal-500',
        };
        return colors[lang] || 'text-gray-500';
    };

    return (
        <tr
            onClick={onClick}
            className="group hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
        >
            {/* Name */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center flex-shrink-0 shadow-sm border border-[var(--border-default)]">
                        <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-600 to-gray-800 dark:from-gray-200 dark:to-gray-400">
                            {project.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <span className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">
                        {project.name}
                    </span>
                </div>
            </td>

            {/* Status */}
            <td className="px-6 py-4">
                {project.status === 'Production' ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Prod</span>
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Dev</span>
                    </div>
                )}
            </td>

            {/* Branch */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span className="font-mono text-xs">{project.branch}</span>
                </div>
            </td>

            {/* Language */}
            <td className="px-6 py-4">
                <span className={cn("text-xs font-medium", getLanguageColor(project.language))}>
                    {project.language}
                </span>
            </td>

            {/* Last Updated */}
            <td className="px-6 py-4">
                <span className="text-xs text-[var(--text-secondary)]">{project.lastUpdated}</span>
            </td>

            <td className="px-6 py-4 text-right">
                <div className={cn(
                    "flex items-center justify-end gap-2 transition-opacity",
                    isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:border-orange-500/50 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-md shadow-sm transition-colors"
                    >
                        Launch
                    </button>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className={cn(
                                "p-1.5 hover:bg-[var(--bg-canvas)] rounded-md transition-colors",
                                isMenuOpen && "bg-[var(--bg-canvas)] text-orange-500"
                            )}
                        >
                            <Settings className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200 backdrop-blur-xl">
                                <button
                                    onClick={handleAiClick}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                    Ask AI assistant
                                </button>
                                <div className="h-px bg-[var(--border-muted)] my-1" />
                                <button
                                    onClick={handleDeleteClick}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete Project
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </td>
        </tr>
    );
}
