import { useState } from 'react';
import { X, Box, LayoutTemplate, Github, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProjectStore } from '@/stores/useProjectStore';
import { useToastStore } from '@/stores/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GitHubService, type Repository } from '@/services/GitHubService';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'select-type' | 'configure-blank' | 'configure-import';
type ProjectType = 'blank' | 'template' | 'import';

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {

    const { createProjectAPI } = useProjectStore();
    const { addToast } = useToastStore();
    const [step, setStep] = useState<Step>('select-type');

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Import Repository State
    const [repos, setRepos] = useState<Repository[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const handleTypeSelect = async (type: ProjectType) => {
        if (type === 'blank') {
            setStep('configure-blank');
        } else if (type === 'import') {
            setStep('configure-import');
            setIsLoadingRepos(true);
            try {
                const fetchedRepos = await GitHubService.listRepos();
                setRepos(fetchedRepos);
            } catch {
                addToast('Failed to load GitHub repositories. Make sure you are logged in with GitHub.', 'error');
            } finally {
                setIsLoadingRepos(false);
            }
        } else {
            addToast('Templates are coming soon!', 'info');
        }
    };

    const handleImport = async () => {
        if (!selectedRepo) return;
        setIsImporting(true);
        try {
            await GitHubService.importRepo(selectedRepo);
            addToast(`Repository "${selectedRepo.name}" imported successfully!`, 'success');
            onClose();
            setStep('select-type');
            setSelectedRepo(null);
            setRepos([]);
        } catch {
            addToast('Failed to import repository. Please try again.', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const handleCreate = async () => {
        if (!name) return;

        setIsCreating(true);

        try {
            await createProjectAPI(name, description);
            addToast(`Project "${name}" created successfully!`, 'success');
            onClose();
            // Reset state
            setStep('select-type');
            setName('');
            setDescription('');
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : 'Failed to create project';
            addToast(message, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const projectTypes = [
        {
            id: 'blank',
            title: 'Blank Project',
            description: 'Start from scratch with a clean slate.',
            icon: Box,
            color: 'bg-blue-500/10 text-blue-500',
            border: 'hover:border-blue-500/50'
        },
        {
            id: 'template',
            title: 'Use Template',
            description: 'Start with a pre-built template.',
            icon: LayoutTemplate,
            color: 'bg-orange-500/10 text-orange-500',
            border: 'hover:border-orange-500/50'
        },
        {
            id: 'import',
            title: 'Import Repository',
            description: 'Clone an existing project from GitHub.',
            icon: Github,
            color: 'bg-purple-500/10 text-purple-500',
            border: 'hover:border-purple-500/50'
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
                    <h2 className="text-lg font-display font-medium text-[var(--text-primary)]">
                        {step === 'select-type' ? 'Create New Project' : step === 'configure-import' ? 'Import Repository' : 'Configure Project'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'select-type' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {projectTypes.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => handleTypeSelect(type.id as ProjectType)}
                                        className={cn(
                                            "flex flex-col items-start p-4 border border-[var(--border-default)] rounded-xl text-left transition-all duration-200 group hover:shadow-md",
                                            type.border
                                        )}
                                    >
                                        <div className={cn("p-3 rounded-lg mb-3 transition-colors", type.color)}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-medium text-[var(--text-primary)] mb-1 group-hover:text-orange-500 transition-colors">{type.title}</h3>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{type.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : step === 'configure-import' ? (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {isLoadingRepos ? (
                                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
                                    <p className="text-sm">Loading your GitHub repositories...</p>
                                </div>
                            ) : repos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
                                    <Github className="w-10 h-10 mb-3 opacity-40" />
                                    <p className="text-sm mb-1">No repositories found</p>
                                    <p className="text-xs opacity-60">Make sure you are logged in with GitHub</p>
                                </div>
                            ) : (
                                <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                                    {repos.map((repo) => (
                                        <button
                                            key={repo.id}
                                            onClick={() => setSelectedRepo(repo)}
                                            className={cn(
                                                "w-full flex items-start p-3 rounded-lg border text-left transition-all duration-150",
                                                selectedRepo?.id === repo.id
                                                    ? "border-purple-500 bg-purple-500/10"
                                                    : "border-[var(--border-default)] hover:border-purple-500/30 hover:bg-white/5"
                                            )}
                                        >
                                            <Github className="w-4 h-4 mt-0.5 mr-3 text-purple-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{repo.full_name}</p>
                                                {repo.description && (
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{repo.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-[var(--text-tertiary)]">{repo.default_branch}</span>
                                                    {repo.private && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">Private</span>}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--text-primary)]">Project Name</label>
                                    <Input
                                        placeholder="my-awesome-project"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--text-primary)]">Description</label>
                                    <textarea
                                        className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md bg-[var(--bg-canvas)] border border-[var(--border-default)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none"
                                        placeholder="Describe your project..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                    <p className="text-xs text-[var(--text-secondary)]">We'll use this to help set up your environment.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-[var(--bg-canvas)]/50 border-t border-[var(--border-default)] flex items-center justify-between">
                    {step === 'configure-blank' ? (
                        <>
                            <button
                                onClick={() => setStep('select-type')}
                                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Back
                            </button>
                            <Button
                                onClick={handleCreate}
                                isLoading={isCreating}
                                disabled={!name}
                                className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
                            >
                                {isCreating ? 'Creating...' : 'Create Project'}
                            </Button>
                        </>
                    ) : step === 'configure-import' ? (
                        <>
                            <button
                                onClick={() => { setStep('select-type'); setSelectedRepo(null); setRepos([]); }}
                                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Back
                            </button>
                            <Button
                                onClick={handleImport}
                                isLoading={isImporting}
                                disabled={!selectedRepo}
                                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                            >
                                {isImporting ? 'Importing...' : 'Import Repository'}
                            </Button>
                        </>
                    ) : (
                        <div className="ml-auto">
                            <span className="text-xs text-[var(--text-tertiary)]">Select an option to continue</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
