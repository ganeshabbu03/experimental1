import { useState } from 'react';
import { X, Box, LayoutTemplate, Github } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProjectStore } from '@/stores/useProjectStore';
import { useToastStore } from '@/stores/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'select-type' | 'configure-blank';
type ProjectType = 'blank' | 'template' | 'import';

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
    if (!isOpen) return null;

    const { createProjectAPI } = useProjectStore();
    const { addToast } = useToastStore();
    const [step, setStep] = useState<Step>('select-type');

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleTypeSelect = (type: ProjectType) => {
        if (type === 'blank') {
            setStep('configure-blank');
        } else {
            // For now, these are placeholders
            alert("This feature is coming soon!");
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
                    <h2 className="text-lg font-display font-medium text-[var(--text-primary)]">
                        {step === 'select-type' ? 'Create New Project' : 'Configure Project'}
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
