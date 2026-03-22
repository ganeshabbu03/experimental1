import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import {
    User, Settings as SettingsIcon, Palette, Shield,
    Bell, CreditCard, Sun, Moon,
    GraduationCap, Brain, Zap
} from 'lucide-react';
import { cn } from '@/utils/cn';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import AvatarUpload from '@/components/profile/AvatarUpload';
import { useToastStore } from '@/stores/useToastStore';

type SettingsTab = 'profile' | 'account' | 'appearance' | 'notifications' | 'billing';

export default function SettingsPage() {
    const { user, updateUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const { isSidebarOpen } = useLayoutStore();
    const { addToast } = useToastStore();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [isLoading, setIsLoading] = useState(false);

    // Form States
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState(user?.role || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [location, setLocation] = useState(user?.location || '');
    const [website, setWebsite] = useState(user?.website || '');
    const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(user?.skillLevel || 'beginner');
    const [newAvatar, setNewAvatar] = useState<string | null>(null);

    const handleSave = async () => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            updateUser({
                name,
                email,
                role,
                bio,
                location,
                website,
                skillLevel,
                ...(newAvatar && { avatar: newAvatar })
            });
            setIsLoading(false);
            addToast('Profile updated successfully!', 'success');
        }, 800);
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
        { id: 'account', label: 'Account', icon: Shield, description: 'Security and authentication' },
        { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and display settings' },
        { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and push preferences' },
        { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Payment methods and plans' },
    ];

    if (!user) return null;

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
                        <span className="text-[var(--text-primary)] font-medium cursor-pointer">settings</span>
                    </div>
                </header>

                <div className="p-8 max-w-6xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">Settings</h1>
                        <p className="text-[var(--text-secondary)]">Manage your account preferences and workspace settings.</p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Settings Navigation */}
                        <nav className="w-full lg:w-64 space-y-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as SettingsTab)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group text-left",
                                            isActive
                                                ? "bg-orange-500/10 text-orange-600 dark:text-orange-500 font-medium"
                                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "w-4 h-4 transition-colors",
                                            isActive ? "text-orange-600 dark:text-orange-500" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]"
                                        )} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-8 shadow-sm">

                                {/* Profile Settings */}
                                {activeTab === 'profile' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div>
                                            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">Public Profile</h2>
                                            <p className="text-sm text-[var(--text-secondary)]">This will be displayed on your public profile.</p>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-8 items-start pb-8 border-b border-[var(--border-default)]">
                                            <div className="shrink-0">
                                                <AvatarUpload
                                                    currentAvatar={user?.avatar || ''}
                                                    onAvatarChange={(_, base64) => setNewAvatar(base64)}
                                                    size="lg"
                                                />
                                            </div>

                                            <div className="flex-1 space-y-6 w-full max-w-2xl">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Display Name</label>
                                                        <Input
                                                            value={name}
                                                            onChange={(e) => setName(e.target.value)}
                                                            className="bg-[var(--bg-canvas)] border-[var(--border-default)] focus:border-orange-500"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Role</label>
                                                        <Input
                                                            value={role}
                                                            onChange={(e) => setRole(e.target.value)}
                                                            placeholder="e.g. Senior Product Designer"
                                                            className="bg-[var(--bg-canvas)] border-[var(--border-default)] focus:border-orange-500"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Email</label>
                                                        <Input
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            disabled
                                                            className="bg-[var(--bg-canvas)] border-[var(--border-default)] opacity-60 cursor-not-allowed"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Bio</label>
                                                    <textarea
                                                        value={bio}
                                                        onChange={(e) => setBio(e.target.value)}
                                                        placeholder="Brief description for your profile..."
                                                        className="w-full min-h-[80px] px-3 py-2 rounded-md text-sm bg-[var(--bg-canvas)] border border-[var(--border-default)] focus:border-orange-500 focus:outline-none text-[var(--text-primary)] resize-y"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Location</label>
                                                        <Input
                                                            value={location}
                                                            onChange={(e) => setLocation(e.target.value)}
                                                            placeholder="City, Country"
                                                            className="bg-[var(--bg-canvas)] border-[var(--border-default)] focus:border-orange-500"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Website</label>
                                                        <Input
                                                            value={website}
                                                            onChange={(e) => setWebsite(e.target.value)}
                                                            placeholder="https://..."
                                                            className="bg-[var(--bg-canvas)] border-[var(--border-default)] focus:border-orange-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Skill Level</label>
                                                        <span className="text-xs text-[var(--text-tertiary)] hidden sm:inline-block">Adjusts AI complexity</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        {[
                                                            { id: 'beginner', label: 'Beginner', icon: GraduationCap, desc: 'Detailed explanations' },
                                                            { id: 'intermediate', label: 'Intermediate', icon: Brain, desc: 'Balanced brevity' },
                                                            { id: 'advanced', label: 'Advanced', icon: Zap, desc: 'Code focused' }
                                                        ].map((level) => {
                                                            const Icon = level.icon;
                                                            const isSelected = skillLevel === level.id;
                                                            return (
                                                                <button
                                                                    key={level.id}
                                                                    onClick={() => setSkillLevel(level.id as any)}
                                                                    className={cn(
                                                                        "relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all duration-200 group hover:border-orange-500/30",
                                                                        isSelected
                                                                            ? "bg-orange-500/5 border-orange-500 ring-4 ring-orange-500/10"
                                                                            : "bg-[var(--bg-canvas)] border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
                                                                    )}
                                                                >
                                                                    <div className={cn("mb-2 p-1.5 rounded-md", isSelected ? "bg-orange-500 text-white" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]")}>
                                                                        <Icon className="w-4 h-4" />
                                                                    </div>
                                                                    <span className={cn("text-xs font-bold mb-0.5", isSelected ? "text-orange-600 dark:text-orange-500" : "text-[var(--text-primary)]")}>
                                                                        {level.label}
                                                                    </span>
                                                                    <span className="text-[10px] text-[var(--text-secondary)] leading-tight">
                                                                        {level.desc}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex justify-end pt-4">
                                                    <Button
                                                        onClick={handleSave}
                                                        isLoading={isLoading}
                                                        className="bg-orange-600 hover:bg-orange-700 text-white px-8"
                                                    >
                                                        Save Changes
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Appearance Settings */}
                                {activeTab === 'appearance' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div>
                                            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">Appearance</h2>
                                            <p className="text-sm text-[var(--text-secondary)]">Customize the look and feel of your workspace.</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={cn(
                                                    "relative p-4 rounded-xl border-2 text-left transition-all duration-200 group overflow-hidden",
                                                    theme === 'light'
                                                        ? "border-orange-500 bg-orange-500/5"
                                                        : "border-[var(--border-default)] hover:border-orange-500/30 bg-[var(--bg-canvas)]"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                                                        <Sun className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-medium text-[var(--text-primary)]">Light Mode</span>
                                                </div>
                                                <div className="space-y-2 opacity-50 pointer-events-none p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                                                    <div className="h-2 w-3/4 bg-gray-200 rounded" />
                                                    <div className="h-2 w-1/2 bg-gray-200 rounded" />
                                                </div>
                                                {theme === 'light' && (
                                                    <div className="absolute top-4 right-4 w-3 h-3 bg-orange-500 rounded-full shadow-sm ring-4 ring-orange-500/20" />
                                                )}
                                            </button>

                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={cn(
                                                    "relative p-4 rounded-xl border-2 text-left transition-all duration-200 group overflow-hidden",
                                                    theme === 'dark'
                                                        ? "border-orange-500 bg-orange-500/5"
                                                        : "border-[var(--border-default)] hover:border-orange-500/30 bg-[var(--bg-canvas)]"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 rounded-lg bg-zinc-800 text-orange-500">
                                                        <Moon className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-medium text-[var(--text-primary)]">Dark Mode</span>
                                                </div>
                                                <div className="space-y-2 opacity-50 pointer-events-none p-3 bg-zinc-900 rounded-lg border border-zinc-700 shadow-sm">
                                                    <div className="h-2 w-3/4 bg-zinc-700 rounded" />
                                                    <div className="h-2 w-1/2 bg-zinc-700 rounded" />
                                                </div>
                                                {theme === 'dark' && (
                                                    <div className="absolute top-4 right-4 w-3 h-3 bg-orange-500 rounded-full shadow-sm ring-4 ring-orange-500/20" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Account / Notification Placeholders */}
                                {['account', 'notifications', 'billing'].includes(activeTab) && (
                                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-300 text-center">
                                        <div className="w-16 h-16 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)] flex items-center justify-center mb-4">
                                            <SettingsIcon className="w-8 h-8 text-[var(--text-tertiary)]" />
                                        </div>
                                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Coming Soon</h3>
                                        <p className="text-[var(--text-secondary)] max-w-sm">
                                            This settings module is currently being developed. Stay tuned for updates!
                                        </p>
                                    </div>
                                )}

                            </div>
                        </div>

                    </div>
                </div>
            </main >
        </div >



    );
}
