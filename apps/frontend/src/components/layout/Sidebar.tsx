
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Home, FolderOpen, Settings,
    Box, Bell, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { cn } from '@/utils/cn';
import Avatar from '@/components/ui/Avatar';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isSidebarOpen, toggleSidebar, setSidebarOpen } = useLayoutStore();
    const { user, logout } = useAuthStore();

    if (!user) return null;

    const navItems = [
        { icon: Home, label: 'Home', path: '/dashboard' },
        { icon: FolderOpen, label: 'Projects', path: '/projects' }, // Keeping dashboard as main for now
        { icon: Box, label: 'Deployments', path: '/deployments' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <aside className={cn(
            "h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border-sidebar)] flex flex-col fixed left-0 top-0 z-50 transition-all duration-300",
            isSidebarOpen ? "w-64" : "w-20"
        )}>
            {/* Header / Workspace Switcher */}
            <div className={cn(
                "h-16 flex items-center border-b border-[var(--border-default)] transition-all",
                isSidebarOpen ? "px-4" : "justify-center px-0"
            )}>
                <div className="flex items-center gap-2 p-1.5">
                    <img
                        src="/deexenlogo.png"
                        alt="Deexen Logo"
                        className="w-8 h-8 object-cover"
                    />
                    {isSidebarOpen && (
                        <span
                            onClick={() => navigate('/dashboard')}
                            className="text-sm font-medium text-[var(--text-primary)] tracking-tight animate-in fade-in duration-200 cursor-pointer hover:text-orange-500 transition-colors"
                        >
                            Deexen AI
                        </span>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-0.5">
                {navItems.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => {
                            if (isActive(item.path)) {
                                toggleSidebar();
                            } else {
                                navigate(item.path);
                                setSidebarOpen(true);
                            }
                        }}
                        title={!isSidebarOpen ? item.label : undefined}
                        id={`sidebar-nav-${item.label.toLowerCase()}`}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-r-lg transition-all duration-200 group relative",
                            isActive(item.path)
                                ? "text-orange-600 dark:text-orange-500 bg-orange-500/5"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]",
                            !isSidebarOpen && "justify-center px-0 rounded-lg"
                        )}
                    >
                        {isActive(item.path) && isSidebarOpen && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-orange-500 rounded-r-full" />
                        )}
                        <item.icon className={cn(
                            "w-5 h-5 transition-colors",
                            isActive(item.path) ? "text-orange-600 dark:text-orange-500" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]"
                        )} />
                        {isSidebarOpen && (
                            <span className="animate-in fade-in duration-200">{item.label}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer / User Profile */}
            <div className="p-3 border-t border-[var(--border-default)]">
                {isSidebarOpen && (
                    <div className="flex items-center justify-between px-2 mb-2 animate-in fade-in">
                        <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Account</div>
                    </div>
                )}

                <button
                    onClick={() => navigate('/profile')}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors group text-left",
                        !isSidebarOpen && "justify-center px-0"
                    )}
                >
                    <Avatar src={user.avatar} alt={user.name} size="sm" />
                    {isSidebarOpen && (
                        <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--text-primary)]">{user.name}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
                        </div>
                    )}
                </button>

                {isSidebarOpen ? (
                    <div className="mt-2 flex items-center gap-1 animate-in fade-in">
                        <button className="flex-1 p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors">
                            <Bell className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="flex-1 p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                            <LogOut className="w-4 h-4 mx-auto" />
                        </button>
                    </div>
                ) : (
                    <div className="mt-2 flex flex-col gap-1 items-center">
                        <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors">
                            <Bell className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-orange-500 transition-colors shadow-sm z-50"
                >
                    {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
            </div>
        </aside>
    );
}

