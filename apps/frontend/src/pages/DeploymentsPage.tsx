import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Rocket } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useThemeStore } from '@/stores/useThemeStore';
import Sidebar from '@/components/layout/Sidebar';
import AiAssistant from '@/components/AiAssistant/AiAssistant';

export default function DeploymentsPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isSidebarOpen } = useLayoutStore();
    const { theme, toggleTheme } = useThemeStore();

    if (!user) return null;

    return (
        <div className="flex h-screen w-full bg-[var(--bg-main)] font-sans text-[var(--text-primary)] overflow-hidden">
            <Sidebar />

            <main className={cn(
                "flex-1 h-full overflow-y-auto overflow-x-hidden relative transition-all duration-300",
                isSidebarOpen ? "ml-64" : "ml-20"
            )}>
                <header className="sticky top-0 z-40 w-full h-16 glass-panel border-b border-[var(--border-muted)] flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <span onClick={() => navigate('/dashboard')} className="hover:text-[var(--text-primary)] cursor-pointer transition-colors">deexen</span>
                        <span className="text-[var(--text-tertiary)]">/</span>
                        <span className="text-[var(--text-primary)] font-medium cursor-pointer">deployments</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                            title="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-6xl mx-auto h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 border border-orange-500/20">
                        <Rocket className="w-10 h-10 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight mb-3">
                            Deployments Coming Soon
                        </h1>
                        <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
                            We are building a seamless one-click deployment experience. Soon you will be able to launch your projects globally in seconds.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/projects')}
                        className="mt-4 px-6 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded-xl text-sm font-medium transition-all"
                    >
                        Go back to Projects
                    </button>
                </div>
            </main>

            <AiAssistant />
        </div>
    );
}
