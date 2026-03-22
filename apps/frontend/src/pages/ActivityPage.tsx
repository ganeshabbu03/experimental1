import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    GitCommit, Rocket, Settings, FileCode, Filter,
    Activity, Flame, FolderOpen, Sun, Moon
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useProjectStore } from '@/stores/useProjectStore';
import Sidebar from '@/components/layout/Sidebar';
import AiAssistant from '@/components/AiAssistant/AiAssistant';

// --- Mock data ---
type EventType = 'commit' | 'deploy' | 'settings' | 'file';

interface ActivityEvent {
    id: string;
    type: EventType;
    title: string;
    project: string;
    timestamp: string;
    group: 'Today' | 'Yesterday' | 'Earlier';
}

const mockEvents: ActivityEvent[] = [
    { id: '1', type: 'commit', title: 'Pushed 3 commits to main', project: 'deexen-frontend', timestamp: '2 hours ago', group: 'Today' },
    { id: '2', type: 'deploy', title: 'Deployed to production', project: 'deexen-frontend', timestamp: '3 hours ago', group: 'Today' },
    { id: '3', type: 'file', title: 'Created SettingsPage.tsx', project: 'deexen-frontend', timestamp: '4 hours ago', group: 'Today' },
    { id: '4', type: 'settings', title: 'Updated billing preferences', project: 'deexen-frontend', timestamp: '5 hours ago', group: 'Today' },
    { id: '5', type: 'commit', title: 'Merged PR #42 — Auth refactor', project: 'deexen-backend', timestamp: '1 day ago', group: 'Yesterday' },
    { id: '6', type: 'deploy', title: 'Deployed preview build', project: 'deexen-backend', timestamp: '1 day ago', group: 'Yesterday' },
    { id: '7', type: 'file', title: 'Deleted legacy migration files', project: 'deexen-backend', timestamp: '1 day ago', group: 'Yesterday' },
    { id: '8', type: 'commit', title: 'Pushed initial project scaffold', project: 'portfolio-site', timestamp: '3 days ago', group: 'Earlier' },
    { id: '9', type: 'settings', title: 'Changed theme to dark mode', project: 'deexen-frontend', timestamp: '4 days ago', group: 'Earlier' },
    { id: '10', type: 'deploy', title: 'First deployment to staging', project: 'portfolio-site', timestamp: '5 days ago', group: 'Earlier' },
];

const eventConfig: Record<EventType, { icon: typeof GitCommit; color: string; bg: string }> = {
    commit: { icon: GitCommit, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    deploy: { icon: Rocket, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    settings: { icon: Settings, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    file: { icon: FileCode, color: 'text-violet-500', bg: 'bg-violet-500/10' },
};

type FilterKey = 'all' | EventType;

export default function ActivityPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isSidebarOpen } = useLayoutStore();
    const { theme, toggleTheme } = useThemeStore();
    const { projects } = useProjectStore();
    const [filter, setFilter] = useState<FilterKey>('all');

    if (!user) return null;

    const filters: { key: FilterKey; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'commit', label: 'Commits' },
        { key: 'deploy', label: 'Deployments' },
        { key: 'settings', label: 'Settings' },
    ];

    const filtered = filter === 'all' ? mockEvents : mockEvents.filter(e => e.type === filter);
    const groups = ['Today', 'Yesterday', 'Earlier'] as const;

    return (
        <div className="flex h-screen w-full bg-[var(--bg-main)] font-sans text-[var(--text-primary)] overflow-hidden">
            <Sidebar />

            <main className={cn(
                "flex-1 h-full overflow-y-auto overflow-x-hidden relative transition-all duration-300",
                isSidebarOpen ? "ml-64" : "ml-20"
            )}>
                {/* Header */}
                <header className="sticky top-0 z-40 w-full h-16 glass-panel border-b border-[var(--border-muted)] flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <span onClick={() => navigate('/dashboard')} className="hover:text-[var(--text-primary)] cursor-pointer transition-colors">deexen</span>
                        <span className="text-[var(--text-tertiary)]">/</span>
                        <span className="text-[var(--text-primary)] font-medium cursor-pointer">activity</span>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                        title="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </header>

                <div className="p-8 max-w-6xl mx-auto space-y-8">

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { title: 'Events Today', value: mockEvents.filter(e => e.group === 'Today').length.toString(), icon: Activity, trend: 'commits, deploys & more', color: 'text-blue-500' },
                            { title: 'Active Projects', value: projects.length.toString(), icon: FolderOpen, trend: 'across workspace', color: 'text-violet-500' },
                            { title: 'Current Streak', value: '7 days', icon: Flame, trend: 'keep going!', color: 'text-orange-500' },
                        ].map((m) => {
                            const Icon = m.icon;
                            return (
                                <div key={m.title} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">{m.title}</p>
                                            <p className={cn("text-3xl font-display font-medium mb-1", m.color)}>{m.value}</p>
                                            <p className="text-[var(--text-secondary)] text-xs"><span className="text-emerald-500 font-medium">{m.trend}</span></p>
                                        </div>
                                        <div className="p-3 bg-violet-500/5 group-hover:bg-violet-500/10 rounded-xl transition-colors">
                                            <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-[var(--text-tertiary)]" />
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                                    filter === f.key
                                        ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Timeline */}
                    {groups.map((group) => {
                        const items = filtered.filter(e => e.group === group);
                        if (items.length === 0) return null;
                        return (
                            <div key={group}>
                                <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">{group}</h3>
                                <div className="relative pl-6 border-l-2 border-[var(--border-default)] space-y-1">
                                    {items.map((event) => {
                                        const cfg = eventConfig[event.type];
                                        const Icon = cfg.icon;
                                        return (
                                            <div key={event.id} className="relative group">
                                                {/* Dot on timeline */}
                                                <div className={cn('absolute -left-[calc(1.5rem+5px)] top-4 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-main)] ring-2', cfg.color === 'text-blue-500' ? 'bg-blue-500 ring-blue-500/20' : cfg.color === 'text-emerald-500' ? 'bg-emerald-500 ring-emerald-500/20' : cfg.color === 'text-orange-500' ? 'bg-orange-500 ring-orange-500/20' : 'bg-violet-500 ring-violet-500/20')} />

                                                <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-default)] transition-all duration-200 cursor-pointer">
                                                    <div className={cn('p-2.5 rounded-lg shrink-0', cfg.bg)}>
                                                        <Icon className={cn('w-4 h-4', cfg.color)} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{event.title}</p>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{event.project}</p>
                                                    </div>
                                                    <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">{event.timestamp}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            <AiAssistant />
        </div>
    );
}
